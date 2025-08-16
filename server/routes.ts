import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loginSchema, insertUserSchema, insertClientSchema, insertWorkoutSchema, insertProgressEntrySchema } from "@shared/schema";
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

      const workouts = await storage.getWorkoutsByCoach(req.user.userId);
      res.json(workouts);
    } catch (error) {
      console.error('Get coach workouts error:', error);
      res.status(500).json({ message: "Internal server error" });
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

      const client = await storage.createClient({
        ...result.data,
        coachId: req.user.userId,
      });
      res.status(201).json(client);
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

      const client = await storage.updateClient(clientId, result.data);
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

  // Workout CRUD routes
  app.post("/api/coach/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = insertWorkoutSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const workout = await storage.createWorkout({
        ...result.data,
        coachId: req.user.userId,
      });
      res.status(201).json(workout);
    } catch (error) {
      console.error('Create workout error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/workouts/:workoutId/complete", authenticateToken, async (req: any, res) => {
    try {
      const { workoutId } = req.params;
      const { duration, notes } = req.body;

      const workout = await storage.completeWorkout(workoutId, duration, notes);
      res.json(workout);
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

      const progress = await storage.createProgressEntry({
        ...result.data,
        clientId: client.id,
      });
      res.status(201).json(progress);
    } catch (error) {
      console.error('Create progress error:', error);
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
          currentWeight: "70.5",
          targetWeight: "65.0",
          height: "165",
        });
      }
    }
  } catch (error) {
    console.error('Demo user creation error:', error);
  }

  const httpServer = createServer(app);
  return httpServer;
}
