import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loginSchema, insertUserSchema, insertClientSchema, insertWorkoutSchema, insertProgressEntrySchema } from "@shared/schema";
import { insertSessionLogSchema, insertBodyMeasurementSchema } from "@shared/sqlite-schema";
import { fromZodError } from "zod-validation-error";

const JWT_SECRET = process.env.JWT_SECRET || "thrst-gym-secret-key";

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists and set up multer storage
  const uploadsDir = path.join(import.meta.dirname, "..", "uploads");
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (e) {
    console.error("Failed to ensure uploads directory:", e);
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => cb(null, uploadsDir),
      filename: (_req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = [
        "image/jpeg","image/png","image/gif","image/webp","image/heic","image/heif",
        "video/mp4","video/webm","video/quicktime"
      ];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      return cb(new Error("Unsupported file type"));
    },
  });

  // Public serving of uploads (works in dev and prod)
  app.use("/uploads", (await import("express")).default.static(uploadsDir));
  
  // File upload route (authenticated)
  app.post("/api/uploads", authenticateToken, (req: any, res) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message: msg });
      }
      const file = (req as any).file as any;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      // Build a public URL to the uploaded file
      const publicUrl = `/uploads/${file.filename}`;
      return res.status(201).json({
        url: publicUrl,
        mime: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      });
    });
  });
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { email, password } = result.data;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { email, password, ...userData } = result.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        ...userData,
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change password (authenticated)
  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "currentPassword and newPassword are required" });
      }

      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashed);
      return res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Protected routes
  app.get("/api/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Coach routes
  app.get("/api/coach/clients", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const clients = await storage.getClientsByCoach(req.user.userId);
      res.json(clients);
    } catch (error) {
      console.error('Get clients error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/coach/stats", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const stats = await storage.getCoachStats(req.user.userId);
      res.json(stats);
    } catch (error) {
      console.error('Get coach stats error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/coach/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }
      // Optional filters via query params
      const includeCompleted = typeof req.query?.includeCompleted !== 'undefined'
        ? String(req.query.includeCompleted).toLowerCase() !== 'false'
        : undefined;
      const clientId = req.query?.clientId ? String(req.query.clientId) : undefined;
      const startDate = req.query?.startDate ? new Date(Number(req.query.startDate) || String(req.query.startDate)) : undefined;
      const endDate = req.query?.endDate ? new Date(Number(req.query.endDate) || String(req.query.endDate)) : undefined;

      const workouts = await storage.getWorkoutsByCoach(req.user.userId, {
        includeCompleted,
        clientId,
        startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
        endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
      });
      res.json(workouts);
    } catch (error) {
      console.error('Get coach workouts error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Messaging routes
  app.get("/api/messages/thread/:coachId/:clientId", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId } = req.params;
      // Authorization: coach can read their threads; client can read their threads
      if (req.user.role === 'coach' && req.user.userId !== coachId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (req.user.role === 'client') {
        const client = await storage.getClientByUserId(req.user.userId);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const limit = req.query?.limit ? Number(req.query.limit) : undefined;
      const messages = await storage.getMessagesByThread(coachId, clientId, { limit });
      res.json(messages);
    } catch (error) {
      console.error('Get messages thread error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark all unread messages in a thread as read for current user
  app.post("/api/messages/thread/:coachId/:clientId/mark-read", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId } = req.params;
      // Authorization mirrors thread fetch: coach only their threads; client only own thread
      if (req.user.role === 'coach' && req.user.userId !== coachId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (req.user.role === 'client') {
        const client = await storage.getClientByUserId(req.user.userId);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const result = await storage.markMessagesReadInThread(coachId, clientId, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Mark thread read error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId, body } = req.body || {};
      if (!coachId || !clientId || typeof body !== 'string' || body.trim().length === 0) {
        return res.status(400).json({ message: "coachId, clientId and non-empty body are required" });
      }

      // Authorization: only coach in thread or the client in thread can send
      if (req.user.role === 'coach') {
        if (req.user.userId !== coachId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user.role === 'client') {
        const client = await storage.getClientByUserId(req.user.userId);
        if (!client || client.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Basic entity validation to avoid FK 500s
      const [coachUser, client] = await Promise.all([
        storage.getUser(coachId),
        storage.getClient(clientId),
      ]);
      if (!coachUser) {
        return res.status(404).json({ message: "Coach user not found for coachId" });
      }
      if (!client) {
        return res.status(404).json({ message: "Client not found for clientId" });
      }
      if (client.coachId !== coachId) {
        return res.status(400).json({ message: "Client does not belong to coach for this thread" });
      }

      // Log minimal payload for debugging
      console.log('Creating message', { coachId, clientId, senderId: req.user.userId, len: body.length });

      const message = await storage.createMessage({
        coachId,
        clientId,
        senderId: req.user.userId,
        body: String(body),
        createdAt: new Date(),
        readAt: null,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Client routes
  app.get("/api/client/profile", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      res.json(client);
    } catch (error) {
      console.error('Get client profile error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client feedback routes
  app.get("/api/client/feedback", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      // This would fetch client feedback data
      // For now, return mock data
      const feedback = [
        {
          id: "1",
          clientId: "client1",
          clientName: "John Doe",
          message: "Great workout today! Feeling stronger already.",
          priority: "normal",
          status: "unread",
          createdAt: new Date().toISOString()
        },
        {
          id: "2", 
          clientId: "client2",
          clientName: "Jane Smith",
          message: "Had some difficulty with the squats, could use some guidance.",
          priority: "high",
          status: "unread",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      res.json(feedback);
    } catch (error) {
      console.error('Get client feedback error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages/thread/:coachId/:clientId", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId } = req.params;
      const { body } = req.body;
      
      if (!body || typeof body !== 'string') {
        return res.status(400).json({ message: "Message body is required" });
      }
      
      // Authorization: coach can send to their clients; client can send to their coach
      if (req.user.role === 'coach' && req.user.userId !== coachId) {
        return res.status(403).json({ message: "Access denied" });
      } else if (req.user.role === 'client') {
    const client = await storage.getClientByUserId(req.user.userId);
    if (!client || client.id !== clientId) {
      return res.status(403).json({ message: "Access denied" });
    }
  } else {
    return res.status(403).json({ message: "Access denied" });
  }

  // Basic entity validation to avoid FK 500s
  const [coachUser, client] = await Promise.all([
    storage.getUser(coachId),
    storage.getClient(clientId),
  ]);
  if (!coachUser) {
    return res.status(404).json({ message: "Coach user not found for coachId" });
  }
  if (!client) {
    return res.status(404).json({ message: "Client not found for clientId" });
  }
  if (client.coachId !== coachId) {
    return res.status(400).json({ message: "Client does not belong to coach for this thread" });
  }

  // Log minimal payload for debugging
  console.log('Creating message', { coachId, clientId, senderId: req.user.userId, len: body.length });

  const message = await storage.createMessage({
    coachId,
    clientId,
    senderId: req.user.userId,
    body: String(body),
    createdAt: new Date(),
    readAt: null,
  });
  res.status(201).json(message);
} catch (error) {
  console.error('Create message error:', error);
  res.status(500).json({ 
    message: "Internal server error",
    error: error instanceof Error ? error.message : String(error)
  });
}
});

// Client routes
app.get("/api/client/profile", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: "Access denied" });
  }

  const client = await storage.getClientByUserId(req.user.userId);
  if (!client) {
    return res.status(404).json({ message: "Client profile not found" });
  }

  res.json(client);
} catch (error) {
  console.error('Get client profile error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

app.get("/api/client/workouts", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: "Access denied" });
  }

  const client = await storage.getClientByUserId(req.user.userId);
  if (!client) {
    return res.status(404).json({ message: "Client profile not found" });
  }

  const workouts = await storage.getWorkoutsByClient(client.id);
  res.json(workouts);
} catch (error) {
  console.error('Get client workouts error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

app.get("/api/client/progress", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: "Access denied" });
  }

  const client = await storage.getClientByUserId(req.user.userId);
  if (!client) {
    return res.status(404).json({ message: "Client profile not found" });
  }

  const progress = await storage.getProgressByClient(client.id);
  res.json(progress);
} catch (error) {
  console.error('Get client progress error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

app.get("/api/client/stats", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: "Access denied" });
  }

  const client = await storage.getClientByUserId(req.user.userId);
  if (!client) {
    return res.status(404).json({ message: "Client profile not found" });
  }

  const stats = await storage.getClientStats(client.id);
  res.json(stats);
} catch (error) {
  console.error('Get client stats error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

// Client CRUD routes
app.post("/api/coach/clients", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: "Access denied" });
  }

  const result = insertClientSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      message: fromZodError(result.error).message 
    });
  }

  const { email, firstName, lastName } = result.data;
  let tempPassword: string | null = null;

  // Check if a user with this email already exists
  let user = await storage.getUserByEmail(email);
  if (user) {
    // If user exists, check if they are already a client for this coach
    const existingClient = await storage.getClientByUserId(user.id);
    if (existingClient && existingClient.coachId === req.user.userId) {
      return res.status(409).json({ message: 'This user is already a client for you.' });
    }
  } else {
    // If user doesn't exist, create a new user with a random password
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    user = await storage.createUser({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'client',
    });
    tempPassword = randomPassword; // expose only in response for coach to share
  }

  // Separate user data from client data
  const { email: clientEmail, firstName: clientFirstName, lastName: clientLastName, ...clientData } = result.data;

  // Normalize goals to Record<string, any> | null
  let goals: Record<string, any> | null = null;
  if (typeof (clientData as any).goals === 'string') {
    try {
      const parsed = JSON.parse((clientData as any).goals as any);
      goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
    }
  } else if ((clientData as any).goals && typeof (clientData as any).goals === 'object' && !Array.isArray((clientData as any).goals)) {
    goals = (clientData as any).goals as any;
  }

  // Create the client profile linked to the user
  const { goals: _ignoredGoals, ...clientRest } = clientData as any;
  const client = await storage.createClient({
    ...clientRest,
    goals,
    userId: user.id,
    coachId: req.user.userId,
  });
  res.status(201).json({ client, tempPassword });
} catch (error) {
  console.error('Create client error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

app.put("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: "Access denied" });
  }

  const { clientId } = req.params;
  const result = insertClientSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      message: fromZodError(result.error).message 
    });
  }

  // Normalize partial update for goals
  const partial = { ...result.data } as any;
  if (typeof partial.goals === 'string') {
    try {
      const parsed = JSON.parse(partial.goals);
      partial.goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
    }
  }
  if (partial.goals !== undefined && partial.goals !== null) {
    if (typeof partial.goals !== 'object' || Array.isArray(partial.goals)) {
      partial.goals = null;
    }
  }

  const { goals: _ignoredUpdateGoals, ...restPartial } = partial;
  const client = await storage.updateClient(clientId, { ...restPartial, goals: partial.goals });
  res.json(client);
} catch (error) {
  console.error('Update client error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

app.delete("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: "Access denied" });
  }

  const { clientId } = req.params;
  await storage.deleteClient(clientId);
  res.status(204).send();
} catch (error) {
  console.error('Delete client error:', error);
  res.status(500).json({ message: "Internal server error" });
}
});

// Bulk import clients endpoint
app.post("/api/coach/clients/bulk-import", authenticateToken, async (req: any, res) => {
try {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ message: "Access denied" });
  }

  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ message: "Clients array is required" });
  }

  const results = [];
  const errors = [];

  // Client feedback routes
  app.get("/api/client/feedback", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      // This would fetch client feedback data
      // For now, return mock data
      const feedback = [
        {
          id: "1",
          clientId: "client1",
          clientName: "John Doe",
          message: "Great workout today! Feeling stronger already.",
          priority: "normal",
          status: "unread",
          createdAt: new Date().toISOString()
        },
        {
          id: "2", 
          clientId: "client2",
          clientName: "Jane Smith",
          message: "Had some difficulty with the squats, could use some guidance.",
          priority: "high",
          status: "unread",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      res.json(feedback);
    } catch (error) {
      console.error('Get client feedback error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/client/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      const workouts = await storage.getWorkoutsByClient(client.id);
      res.json(workouts);
    } catch (error) {
      console.error('Get client workouts error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/client/progress", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      const progress = await storage.getProgressByClient(client.id);
      res.json(progress);
    } catch (error) {
      console.error('Get client progress error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/client/stats", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      const stats = await storage.getClientStats(client.id);
      res.json(stats);
    } catch (error) {
      console.error('Get client stats error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client CRUD routes
  app.post("/api/coach/clients", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = insertClientSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { email, firstName, lastName } = result.data;
      let tempPassword: string | null = null;

      // Check if a user with this email already exists
      let user = await storage.getUserByEmail(email);
      if (user) {
        // If user exists, check if they are already a client for this coach
        const existingClient = await storage.getClientByUserId(user.id);
        if (existingClient && existingClient.coachId === req.user.userId) {
          return res.status(409).json({ message: 'This user is already a client for you.' });
        }
      } else {
        // If user doesn't exist, create a new user with a random password
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'client',
        });
        tempPassword = randomPassword; // expose only in response for coach to share
      }

      // Separate user data from client data
      const { email: clientEmail, firstName: clientFirstName, lastName: clientLastName, ...clientData } = result.data;

      // Normalize goals to Record<string, any> | null
      let goals: Record<string, any> | null = null;
      if (typeof (clientData as any).goals === 'string') {
        try {
          const parsed = JSON.parse((clientData as any).goals as any);
          goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
        }
      } else if ((clientData as any).goals && typeof (clientData as any).goals === 'object' && !Array.isArray((clientData as any).goals)) {
        goals = (clientData as any).goals as any;
      }

      // Create the client profile linked to the user
      const { goals: _ignoredGoals, ...clientRest } = clientData as any;
      const client = await storage.createClient({
        ...clientRest,
        goals,
        userId: user.id,
        coachId: req.user.userId,
      });
      res.status(201).json({ client, tempPassword });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;
      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      // Normalize partial update for goals
      const partial = { ...result.data } as any;
      if (typeof partial.goals === 'string') {
        try {
          const parsed = JSON.parse(partial.goals);
          partial.goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
        }
      }
      if (partial.goals !== undefined && partial.goals !== null) {
        if (typeof partial.goals !== 'object' || Array.isArray(partial.goals)) {
          partial.goals = null;
        }
      }

      const { goals: _ignoredUpdateGoals, ...restPartial } = partial;
      const client = await storage.updateClient(clientId, { ...restPartial, goals: partial.goals });
      res.json(client);
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;
      await storage.deleteClient(clientId);
      res.status(204).send();
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk import clients endpoint
  app.post("/api/coach/clients/bulk-import", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clients } = req.body;
      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ message: "Clients array is required" });
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < clients.length; i++) {
        const clientData = clients[i];
        
        try {
          // Validate each client
          const result = insertClientSchema.safeParse(clientData);
          if (!result.success) {
            errors.push({
              index: i,
              client: clientData,
              error: fromZodError(result.error).message
            });
            continue;
          }

          const { email, firstName, lastName } = result.data;
          let tempPassword: string | null = null;

          // Check if user exists
          let user = await storage.getUserByEmail(email);
          if (user) {
            // Check if already a client for this coach
            const existingClient = await storage.getClientByUserId(user.id);
            if (existingClient && existingClient.coachId === req.user.userId) {
              errors.push({
                index: i,
                client: clientData,
                error: 'User is already a client for this coach'
              });
              continue;
            }
          } else {
            // Create new user
            const randomPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            user = await storage.createUser({
              email,
              password: hashedPassword,
              firstName,
              lastName,
              role: 'client',
            });
            tempPassword = randomPassword;
          }

          // Process goals
          let goals: Record<string, any> | null = null;
          if (typeof (clientData as any).goals === 'string') {
            try {
              const parsed = JSON.parse((clientData as any).goals);
              goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { description: (clientData as any).goals };
            } catch (e) {
              goals = { description: (clientData as any).goals };
            }
          } else if ((clientData as any).goals && typeof (clientData as any).goals === 'object' && !Array.isArray((clientData as any).goals)) {
            goals = (clientData as any).goals;
          }

          // Create client profile
          const { email: _email, firstName: _firstName, lastName: _lastName, goals: _goals, ...clientRest } = result.data as any;
          const client = await storage.createClient({
            ...clientRest,
            goals,
            userId: user.id,
            coachId: req.user.userId,
          });

          results.push({
            success: true,
            client,
            tempPassword,
            originalIndex: i
          });

        } catch (error) {
          console.error(`Error creating client ${i}:`, error);
          errors.push({
            index: i,
            client: clientData,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: results.length,
        failed: errors.length,
        total: clients.length,
        results,
        errors
      });

    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Workout CRUD routes
  app.post("/api/coach/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log('Received workout data:', JSON.stringify(req.body, null, 2));

      // Helper function to parse date values (string | number | Date)
      const parseDate = (value: any): Date | null => {
        if (!value) return null;
        try {
          if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
          if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
          }
          const d = new Date(value);
          return isNaN(d.getTime()) ? null : d;
        } catch (e) {
          console.error('Error parsing date:', value, e);
          return null;
        }
      };

      // Parse and validate the request body
      // Include coachId BEFORE validation to satisfy schema requirements
      // Safely handle exercises which may be JSON string or array
      let exercisesValue: any[] = [];
      if (typeof req.body?.exercises === 'string') {
        try {
          const parsed = JSON.parse(req.body.exercises);
          exercisesValue = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return res.status(400).json({ message: 'Invalid exercises JSON' });
        }
      } else if (Array.isArray(req.body?.exercises)) {
        exercisesValue = req.body.exercises;
      }

      const payloadForValidation = {
        ...req.body,
        coachId: req.user?.userId,
        // Ensure dates are properly handled
        scheduledDate: parseDate(req.body?.scheduledDate),
        completedAt: parseDate(req.body?.completedAt),
        // Normalized exercises
        exercises: exercisesValue
      } as any;

      console.log('Auth user on create workout:', JSON.stringify(req.user, null, 2));
      console.log('Payload for workout validation:', JSON.stringify(payloadForValidation, null, 2));

      const result = insertWorkoutSchema.safeParse(payloadForValidation);
      
      if (!result.success) {
        console.error('Validation error:', result.error);
        return res.status(400).json({ 
          message: fromZodError(result.error).message,
          errors: result.error.errors
        });
      }

      console.log('Creating workout with data:', JSON.stringify(result.data, null, 2));

      // Add coach ID (already present) and ensure exercises is an array
      const workoutData = {
        ...result.data,
        coachId: req.user.userId,
        exercises: Array.isArray(result.data.exercises) ? result.data.exercises : []
      };

      // Validate required fields
      if (!workoutData.clientId) {
        return res.status(400).json({ message: 'Client ID is required' });
      }


      // Validate exercises
      if (!Array.isArray(workoutData.exercises)) {
        return res.status(400).json({ message: 'Exercises must be an array' });
      }

      // Process exercises
      workoutData.exercises = workoutData.exercises.map((ex: any) => ({
        name: ex.name || 'Unnamed Exercise',
        sets: Number(ex.sets) || 1,
        reps: Number(ex.reps) || 1,
        weight: Number(ex.weight) || 0,
        ...ex
      }));

      console.log('Processed workout data:', JSON.stringify(workoutData, null, 2));

      const workout = await storage.createWorkout(workoutData);
      res.status(201).json(workout);
    } catch (error) {
      console.error('Create workout error:', error);
      res.status(500).json({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Complete workout endpoint
  app.post('/api/coach/workouts/:workoutId/complete', authenticateToken, async (req: any, res) => {
    try {
      const { workoutId } = req.params;
      const { duration, notes } = req.body;

      // Get the workout to verify ownership
      const workout = await storage.getWorkout(workoutId);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }

      // Verify the workout belongs to the authenticated client
      const client = await storage.getClientByUserId(req.user.userId);
      if (!client || workout.clientId !== client.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedWorkout = await storage.completeWorkout(workoutId, duration, notes);
      res.json(updatedWorkout);
    } catch (error) {
      console.error('Complete workout error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Progress tracking routes
  app.post("/api/client/progress", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      const result = insertProgressEntrySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { photos: rawPhotos, measurements: rawMeasurements, ...progressData } = result.data;

      // Ensure photos and measurements are correctly typed
      let photos: string[] | null = rawPhotos as any;
      if (typeof photos === 'string') {
        try { photos = JSON.parse(photos); } catch (e) { photos = null; }
      }
      if (!Array.isArray(photos)) {
        photos = null;
      }

      let measurements: Record<string, any> | null = rawMeasurements as any;
      if (typeof measurements === 'string') {
        try { measurements = JSON.parse(measurements); } catch (e) { measurements = null; }
      }
      if (measurements !== null && (typeof measurements !== 'object' || Array.isArray(measurements))) {
        measurements = null;
      }

      const progress = await storage.createProgressEntry({
        ...progressData,
        clientId: client.id,
        weight: progressData.weight ? Number(progressData.weight) : null,
        bodyFat: progressData.bodyFat ? Number(progressData.bodyFat) : null,
        muscleMass: progressData.muscleMass ? Number(progressData.muscleMass) : null,
        photos,
        measurements,
      });
      res.status(201).json(progress);
    } catch (error) {
      console.error('Create progress error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session Logs
  // Client: list own session logs
  app.get("/api/client/session-logs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ message: "Access denied" });
      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) return res.status(404).json({ message: "Client profile not found" });
      const logs = await storage.getSessionLogsByClient(client.id);
      res.json(logs);
    } catch (error) {
      console.error('Get client session logs error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Coach: list session logs for a specific client (must own client)
  app.get("/api/coach/clients/:clientId/session-logs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') return res.status(403).json({ message: "Access denied" });
      const { clientId } = req.params;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (client.coachId !== req.user.userId) return res.status(403).json({ message: "Access denied" });
      const logs = await storage.getSessionLogsByClient(clientId);
      res.json(logs);
    } catch (error) {
      console.error('Get coach client session logs error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Coach: create a session log for a client (must own client)
  app.post("/api/coach/clients/:clientId/session-logs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') return res.status(403).json({ message: "Access denied" });
      const { clientId } = req.params;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (client.coachId !== req.user.userId) return res.status(403).json({ message: "Access denied" });

      // Normalize payload types
      // performed (can be JSON string or array)
      let performedValue: any[] = [];
      if (typeof req.body?.performed === 'string') {
        try { const parsed = JSON.parse(req.body.performed); performedValue = Array.isArray(parsed) ? parsed : []; } catch { performedValue = []; }
      } else if (Array.isArray(req.body?.performed)) {
        performedValue = req.body.performed;
      }

      // date: accept number/string/Date -> Date
      const parseToDate = (v: any): Date | undefined => {
        if (v === null || typeof v === 'undefined' || v === '') return undefined;
        try {
          if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isNaN(n)) {
            const d = new Date(n);
            return isNaN(d.getTime()) ? undefined : d;
          }
          const d = new Date(String(v));
          return isNaN(d.getTime()) ? undefined : d;
        } catch {
          return undefined;
        }
      };
      const normalizedDate = parseToDate(req.body?.date);

      // numeric coercions
      const toNumberOrUndef = (v: any) => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const normalizedDuration = toNumberOrUndef(req.body?.duration);
      const normalizedAvgRpe = toNumberOrUndef(req.body?.averageRpe);

      // workoutId: if provided, ensure it belongs to this client/coach to avoid FK errors
      let normalizedWorkoutId: string | undefined = undefined;
      if (req.body?.workoutId) {
        const workoutId = String(req.body.workoutId);
        try {
          const workout = await storage.getWorkout(workoutId);
          if (!workout) {
            return res.status(400).json({ message: "Invalid workoutId: workout not found" });
          }
          if (workout.clientId !== clientId || workout.coachId !== req.user.userId) {
            return res.status(400).json({ message: "Invalid workoutId: workout does not belong to client/coach" });
          }
          normalizedWorkoutId = workoutId;
        } catch (e) {
          return res.status(400).json({ message: "Invalid workoutId" });
        }
      }

      const payload = {
        clientId,
        coachId: req.user.userId,
        performed: performedValue,
        workoutId: normalizedWorkoutId,
        date: normalizedDate,
        duration: normalizedDuration,
        averageRpe: normalizedAvgRpe,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      } as any;

      // Debug: log normalized payload before validation
      console.log('SessionLog normalized payload:', JSON.stringify({ ...payload, performedLen: Array.isArray(payload.performed) ? payload.performed.length : 0 }, null, 2));

      const validation = insertSessionLogSchema.safeParse(payload);
      if (!validation.success) {
        console.error('SessionLog validation error:', validation.error);
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      console.log('SessionLog validated payload:', JSON.stringify(validation.data, null, 2));

      const created = await storage.createSessionLog(validation.data as any);
      res.status(201).json(created);
    } catch (error) {
      console.error('Create session log error:', error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Body Measurements
  // Client: list own body measurements
  app.get("/api/client/body-measurements", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ message: "Access denied" });
      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) return res.status(404).json({ message: "Client profile not found" });
      const list = await storage.getBodyMeasurementsByClient(client.id);
      res.json(list);
    } catch (error) {
      console.error('Get client body measurements error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client: create own measurement entry
  app.post("/api/client/body-measurements", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ message: "Access denied" });
      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) return res.status(404).json({ message: "Client profile not found" });

      // Normalize measurements field
      let measurementsValue: any = req.body?.measurements;
      if (typeof measurementsValue === 'string') {
        try { measurementsValue = JSON.parse(measurementsValue); } catch { measurementsValue = {}; }
      }
      if (measurementsValue !== null && (typeof measurementsValue !== 'object' || Array.isArray(measurementsValue))) {
        measurementsValue = {};
      }

      const validation = insertBodyMeasurementSchema.safeParse({
        ...req.body,
        clientId: client.id,
        measurements: measurementsValue,
      });
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      const created = await storage.createBodyMeasurement(validation.data as any);
      res.status(201).json(created);
    } catch (error) {
      console.error('Create client body measurement error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Coach: list measurements for a specific client (must own client)
  app.get("/api/coach/clients/:clientId/body-measurements", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') return res.status(403).json({ message: "Access denied" });
      const { clientId } = req.params;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (client.coachId !== req.user.userId) return res.status(403).json({ message: "Access denied" });
      const list = await storage.getBodyMeasurementsByClient(clientId);
      res.json(list);
    } catch (error) {
      console.error('Get coach client body measurements error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create demo users on startup
  try {
    const demoCoach = await storage.getUserByEmail("coach@thrst.com");
    if (!demoCoach) {
      const hashedPassword = await bcrypt.hash("coach123", 10);
      await storage.createUser({
        email: "coach@thrst.com",
        password: hashedPassword,
        role: "coach",
        firstName: "Alex",
        lastName: "Thompson",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150",
      });
    }

    const demoClient = await storage.getUserByEmail("client@thrst.com");
    if (!demoClient) {
      const hashedPassword = await bcrypt.hash("client123", 10);
      const clientUser = await storage.createUser({
        email: "client@thrst.com",
        password: hashedPassword,
        role: "client",
        firstName: "Sarah",
        lastName: "Johnson",
        avatar: "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150",
      });

      // Create client profile
      const coach = await storage.getUserByEmail("coach@thrst.com");
      if (coach) {
        await storage.createClient({
          userId: clientUser.id,
          coachId: coach.id,
          goals: { target: "Weight Loss", timeline: "3 months" },
          currentWeight: 70.5,
          targetWeight: 65.0,
          height: 165,
        });
      }
    }
  } catch (error) {
    console.error('Demo user creation error:', error);
  }

  const httpServer = createServer(app);
  return httpServer;
}
