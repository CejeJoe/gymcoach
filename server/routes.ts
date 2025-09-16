import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { authenticateToken, JWT_SECRET } from "./auth";
import { loginSchema, insertUserSchema, insertClientSchema, insertWorkoutSchema, insertProgressEntrySchema, insertSessionLogSchema, insertBodyMeasurementSchema } from "@shared/mysql-schema";
import { fromZodError } from "zod-validation-error";


// Multer configuration for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export function registerRoutes(app: Express): Server {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Send a scheduled group message immediately (bypass scheduler)
  app.post("/api/coach/group-messages/:id/send-now", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "Missing message id" });

      // Mark as processing then process immediately
      await storage.sendGroupMessageNow(id, req.user.userId);
      await storage.processGroupMessage(id);

      return res.json({ id, status: 'sent' });
    } catch (error: any) {
      console.error('Send-now group message error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error', error: error?.message });
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { email, password, firstName, lastName, role } = result.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'client',
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).message 
        });
      }

      const { email, password } = result.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      const user = await storage.getUser((req as any).user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
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

      // Get real stats from database
      const stats = await storage.getCoachStats(req.user.userId);
      res.json(stats);
    } catch (error) {
      console.error('Get coach stats error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Coach workouts route
  app.get("/api/coach/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { includeCompleted, startDate, endDate, clientId } = req.query;
      
      const options: any = {};
      if (includeCompleted !== undefined) {
        options.includeCompleted = includeCompleted === 'true';
      }
      if (startDate) {
        options.startDate = new Date(Number(startDate));
      }
      if (endDate) {
        options.endDate = new Date(Number(endDate));
      }
      if (clientId) {
        options.clientId = clientId;
      }

      // Get real workouts from database
      const workouts = await storage.getWorkoutsByCoach(req.user.userId, options);
      res.json({ workouts });
    } catch (error) {
      console.error('Get coach workouts error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create client route
  app.post("/api/coach/clients", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { email, firstName, lastName, goals, currentWeight, targetWeight, height, generateTempPassword } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      let tempPassword = null;

      if (!user) {
        const shouldGenerate = (generateTempPassword === undefined) ? true : Boolean(generateTempPassword);
        if (!shouldGenerate) {
          return res.status(400).json({ message: "User account not found. Ask the client to sign up first, then add them." });
        }
        // Create new user account with a temporary password
        tempPassword = Math.random().toString(36).slice(-8);
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.default.hash(tempPassword, 10);

        user = await storage.createUser({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'client'
        });
      }

      // Create client profile
      const client = await storage.createClient({
        userId: user.id,
        coachId: req.user.userId,
        goals: goals || null,
        currentWeight: currentWeight || null,
        targetWeight: targetWeight || null,
        height: height || null,
        isActive: true
      });

      res.status(201).json({ 
        client: {
          ...client,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        },
        tempPassword 
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset a client's password (coach generates a new temporary password)
  app.post("/api/coach/clients/:clientId/reset-password", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (client.coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Generate and set a new temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      await storage.updateUserPassword(client.userId, hashedPassword);

      return res.json({ clientId, userId: client.userId, tempPassword });
    } catch (error: any) {
      console.error('Reset client password error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update client (PUT/PATCH)
  app.put("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;

      // Verify client exists and belongs to this coach
      const existing = await storage.getClient(clientId);
      if (!existing) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (existing.coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Validate partial client payload using schema.partial()
      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      // Normalize goals field if provided
      const updates: any = { ...result.data };
      if (typeof updates.goals === 'string') {
        try {
          const parsed = JSON.parse(updates.goals);
          updates.goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch {
          return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
        }
      }
      if (updates.goals !== undefined && updates.goals !== null) {
        if (typeof updates.goals !== 'object' || Array.isArray(updates.goals)) {
          updates.goals = null;
        }
      }

      // Split updates between user and client tables
      const clientFieldWhitelist = new Set(['goals', 'currentWeight', 'targetWeight', 'height', 'startDate', 'isActive']);
      const userFieldWhitelist = new Set(['email', 'firstName', 'lastName', 'avatar']);
      const clientUpdates: any = {};
      const userUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) {
        if (clientFieldWhitelist.has(k) && v !== undefined) clientUpdates[k] = v;
        if (userFieldWhitelist.has(k) && v !== undefined) userUpdates[k] = v;
      }

      // Perform updates
      if (Object.keys(userUpdates).length > 0) {
        await storage.updateUserProfile(existing.userId, userUpdates);
      }
      const updated = Object.keys(clientUpdates).length > 0
        ? await storage.updateClient(clientId, clientUpdates)
        : existing;

      // Return enriched client (include nested user like other endpoints)
      const user = await storage.getUser(updated.userId);
      return res.json({
        ...updated,
        isActive: Boolean((updated as any).isActive),
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: (user as any).avatar ?? null,
        } : null,
      });
    } catch (error: any) {
      console.error('Update client error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Support PATCH as well (same handler)
  app.patch("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
    // Delegate to PUT logic by calling the handler body directly
    try {
      // Reuse the logic by making an internal call to the PUT path
      // Not easily callable directly; duplicate minimal logic
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;
      const existing = await storage.getClient(clientId);
      if (!existing) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (existing.coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const updates: any = { ...result.data };
      if (typeof updates.goals === 'string') {
        try {
          const parsed = JSON.parse(updates.goals);
          updates.goals = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch {
          return res.status(400).json({ message: 'Invalid goals format. Must be a valid JSON object.' });
        }
      }
      if (updates.goals !== undefined && updates.goals !== null) {
        if (typeof updates.goals !== 'object' || Array.isArray(updates.goals)) {
          updates.goals = null;
        }
      }

      const clientFieldWhitelist = new Set([
        'goals', 'currentWeight', 'targetWeight', 'height', 'startDate', 'isActive'
      ]);
      const clientUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) {
        if (clientFieldWhitelist.has(k) && v !== undefined) clientUpdates[k] = v;
      }

      const updated = await storage.updateClient(clientId, clientUpdates);
      const user = await storage.getUser(updated.userId);
      return res.json({
        ...updated,
        isActive: Boolean((updated as any).isActive),
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: (user as any).avatar ?? null,
        } : null,
      });
    } catch (error: any) {
      console.error('Patch client error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete client (soft-delete by setting isActive=false)
  app.delete("/api/coach/clients/:clientId", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { clientId } = req.params;
      const existing = await storage.getClient(clientId);
      if (!existing) {
        return res.status(404).json({ message: 'Client not found' });
      }
      if (existing.coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteClient(clientId);
      return res.status(204).send();
    } catch (error: any) {
      console.error('Delete client error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create workout route
  app.post("/api/coach/workouts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, description, clientId, scheduledDate, exercises } = req.body;
      
      if (!name || !clientId) {
        return res.status(400).json({ message: "Name and clientId are required" });
      }

      const workoutData = {
        name,
        description,
        clientId,
        coachId: req.user.userId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        exercises: exercises || []
      };

      // Create real workout in database
      const newWorkout = await storage.createWorkout(workoutData);
      res.status(201).json(newWorkout);
    } catch (error) {
      console.error('Create workout error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Complete workout route
  app.post("/api/coach/workouts/:workoutId/complete", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { workoutId } = req.params;
      const { duration, notes } = req.body;
      
      if (!workoutId) {
        return res.status(400).json({ message: "Workout ID is required" });
      }

      // Complete workout in database
      const completedWorkout = await storage.completeWorkout(workoutId, duration || 0, notes);
      res.json(completedWorkout);
    } catch (error) {
      console.error('Complete workout error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Messages routes
  app.get("/api/messages/thread/:coachId/:clientId", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId } = req.params;
      const { limit } = req.query;
      
      // Authorization: coach can read their threads; client can read their threads
      if (req.user.role === 'coach' && req.user.userId !== coachId) {
        return res.status(403).json({ message: "Access denied" });
      } else if (req.user.role === 'client') {
        // Client can only read their own thread
        // We'd need to verify clientId belongs to req.user.userId
      }

      const options: any = {};
      if (limit) {
        options.limit = parseInt(limit as string);
      }

      // Get real messages from database
      const messages = await storage.getMessagesByThread(coachId, clientId, options);
      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
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
      }

      const messageData = {
        id: crypto.randomUUID(),
        coachId,
        clientId,
        senderId: req.user.userId,
        body: String(body),
        createdAt: new Date(),
        readAt: null as Date | null
      };

      // Create real message in database
      const message = await storage.createMessage(messageData as any);
      res.status(201).json(message);
    } catch (error: any) {
      console.error('Create message error:', error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/messages/thread/:coachId/:clientId/mark-read", authenticateToken, async (req: any, res) => {
    try {
      const { coachId, clientId } = req.params;
      
      // Authorization mirrors thread fetch
      if (req.user.role === 'coach' && req.user.userId !== coachId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Mark messages as read in database
      const result = await storage.markMessagesReadInThread(coachId, clientId, req.user.userId);
      res.json({ success: true, markedCount: result.updated });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client routes (profile, workouts, stats, progress)
  app.get("/api/client/profile", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      const user = await storage.getUser(client.userId);
      return res.json({
        ...client,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        } : undefined,
      });
    } catch (error) {
      console.error('Get client profile error:', error);
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


  // Client feedback route (derived from real client-originated messages)
  app.get("/api/client/feedback", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const rows = await storage.getRecentClientFeedbackByCoach(req.user.userId, 50);
      const feedback = rows.map((r: any) => {
        const text = String(r.body || '').trim();
        // Simple priority heuristic based on keywords; safe defaults
        const lower = text.toLowerCase();
        const priority = lower.includes('pain') || lower.includes('injury') ? 'urgent'
          : (lower.includes('help') || lower.includes('issue') || lower.includes('difficulty')) ? 'high'
          : 'medium';
        return {
          id: r.id,
          clientId: r.clientId,
          clientName: r.clientName || 'Client',
          type: 'feedback',
          priority,
          message: text,
          timestamp: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt || Date.now())).toISOString(),
          status: r.readAt ? 'read' as const : 'unread' as const,
          rating: undefined,
          workoutId: r.workoutId || undefined,
          sessionDate: undefined,
        };
      });
      res.json(feedback);
    } catch (error) {
      console.error('Get client feedback error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Group Messages (Broadcasts) endpoints
  app.post("/api/coach/group-messages", authenticateToken, async (req: any, res) => {
    try {
      console.log('POST /api/coach/group-messages - Request body:', JSON.stringify(req.body, null, 2));
      console.log('User:', req.user);
      
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { title, body, scheduledAt, audience, requireConfirmation, workoutId } = req.body;
      
      console.log('Extracted fields:', { title, body, scheduledAt, audience, requireConfirmation, workoutId });
      
      if (!body || !scheduledAt || !audience) {
        return res.status(400).json({ message: "Body, scheduledAt, and audience are required" });
      }

      console.log('About to create group message...');
      const groupMessage = await storage.createGroupMessage({
        coachId: req.user.userId,
        title: title || null,
        body,
        scheduledAt: new Date(scheduledAt),
        audience: JSON.stringify(audience),
        requireConfirmation: Boolean(requireConfirmation),
        workoutId: workoutId || null,
        status: 'scheduled'
      });

      console.log('Group message created successfully:', groupMessage);
      res.status(201).json(groupMessage);
    } catch (error) {
      console.error('Create group message error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  app.get("/api/coach/group-messages", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status, limit } = req.query;
      const groupMessages = await storage.getGroupMessagesByCoach(req.user.userId, {
        status: status || undefined,
        limit: limit ? parseInt(limit) : undefined
      });

      res.json(groupMessages);
    } catch (error) {
      console.error('Get group messages error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/coach/group-messages/:id/cancel", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      await storage.cancelGroupMessage(id, req.user.userId);
      res.json({ message: "Group message canceled" });
    } catch (error) {
      console.error('Cancel group message error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  

  app.post("/api/group-messages/:id/confirm", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const client = await storage.getClientByUserId(req.user.userId);
      if (!client) {
        return res.status(404).json({ message: "Client profile not found" });
      }

      await storage.confirmGroupMessage(id, client.id);
      res.json({ message: "Message confirmed" });
    } catch (error) {
      console.error('Confirm group message error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return createServer(app);
}
