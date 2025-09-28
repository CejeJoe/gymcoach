import type { Express } from "express";
import express from "express";
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
import { db } from "./db";
import { coachProfiles, emailVerifications, users, clients, workouts, messages, auditLogs, usageEvents } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";


// Lightweight analytics logging helper (best-effort; does not block responses)
async function logUsage(
  eventType: string,
  data: { actorType?: string; actorId?: string; coachId?: string; clientId?: string; metadata?: any }
) {
  try {
    await db.insert(usageEvents).values({
      id: crypto.randomUUID(),
      eventType,
      actorType: data.actorType,
      actorId: data.actorId,
      coachId: data.coachId,
      clientId: data.clientId,
      metadata: data.metadata ?? {},
      createdAt: new Date(),
    } as any);
  } catch (e) {
    console.warn('usageEvents insert failed', e);
  }
}


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
  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Delete a workout (coach only, must own)
  app.delete("/api/coach/workouts/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: 'Missing workout id' });

      const existing = await storage.getWorkout(id);
      if (!existing) return res.status(404).json({ message: 'Workout not found' });
      if ((existing as any).coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteWorkout(id);
      // usage event
      logUsage('workout_deleted', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, clientId: (existing as any).clientId, metadata: { workoutId: id } }).catch(() => {});
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('Delete workout error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Force-download endpoint for files under /uploads
  app.get("/api/download", authenticateToken, async (req: any, res) => {
    try {
      const relPath = String(req.query.path || "");
      const downloadName = req.query.name ? String(req.query.name) : undefined;
      if (!relPath.startsWith("/uploads/")) {
        return res.status(400).json({ message: "Invalid path" });
      }
      const absPath = path.join(process.cwd(), relPath);
      // Ensure the path is within uploadDir to prevent traversal
      const normalized = path.normalize(absPath);
      if (!normalized.startsWith(uploadDir)) {
        return res.status(400).json({ message: "Invalid path" });
      }
      if (!fs.existsSync(normalized)) {
        return res.status(404).json({ message: "File not found" });
      }
      return res.download(normalized, downloadName || path.basename(normalized));
    } catch (error: any) {
      console.error("Download error:", error?.message || error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload endpoint for chat attachments and avatars
  app.post("/api/uploads", authenticateToken, upload.single("file"), async (req: any, res) => {
    try {
      // Minimal logging to aid debugging
      // console.log('[upload] user', req.user?.userId, 'file?', Boolean(req.file));
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const file = req.file;
      const urlPath = `/uploads/${file.filename}`;
      return res.status(201).json({
        url: urlPath,
        mime: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      });
    } catch (error: any) {
      console.error('Upload error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update current user's profile
  app.patch("/api/me", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { firstName, lastName, email, avatar } = req.body || {};

      // Basic validation: require at least one field
      if (
        firstName === undefined &&
        lastName === undefined &&
        email === undefined &&
        avatar === undefined
      ) {
        return res.status(400).json({ message: "No fields to update" });
      }

      // Apply updates
      const updated = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        email,
        avatar,
      } as any);

      return res.json({
        id: updated.id,
        email: updated.email,
        firstName: (updated as any).firstName,
        lastName: (updated as any).lastName,
        role: (updated as any).role,
        avatar: (updated as any).avatar ?? null,
      });
    } catch (error: any) {
      console.error('Update /api/me error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
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

      // Create user (ensure role is one of the allowed literals)
      const roleIn: string | undefined = role as any;
      const safeRole: 'coach' | 'client' | 'admin' = (roleIn === 'coach' || roleIn === 'client' || roleIn === 'admin') ? roleIn : 'client';
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: safeRole,
      } as any);

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

  // Public: Register as Coach (email verification + admin approval flow)
  app.post("/api/auth/register-coach", async (req: any, res) => {
    try {
      const { email, password, firstName, lastName, phone, bio, specialties } = req.body || {};
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "email, password, firstName, lastName are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      // Create coach user (not verified yet)
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'coach' as any,
      } as any);

      // Create pending coach profile
      const now = new Date();
      await db.insert(coachProfiles).values({
        id: crypto.randomUUID(),
        userId: user.id,
        status: 'pending',
        bio: bio || null,
        specialties: Array.isArray(specialties) ? specialties : null,
        phone: phone || null,
        createdAt: now,
        updatedAt: now,
      } as any);

      // Create email verification token
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h
      await db.insert(emailVerifications).values({
        id: crypto.randomUUID(),
        userId: user.id,
        token,
        expiresAt,
        createdAt: new Date(),
      } as any);

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      // Email sending slot: configure your provider via env and send verifyUrl
      console.log('[register-coach] Verification URL (configure email to send this):', verifyUrl);

      return res.status(201).json({ message: "Registration received. Please check your email to verify.", verifyUrlHint: process.env.NODE_ENV !== 'production' ? verifyUrl : undefined });
    } catch (error: any) {
      console.error('Register coach error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Public: Verify email link
  app.get("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Missing token' });
      }

      const [row] = await db.select().from(emailVerifications).where(eq(emailVerifications.token as any, token));
      if (!row) return res.status(404).json({ message: 'Invalid token' });
      if (row.usedAt) return res.status(400).json({ message: 'Token already used' });
      if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return res.status(400).json({ message: 'Token expired' });

      await db.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.id, row.id));
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
      return res.json({ verified: true });
    } catch (error: any) {
      console.error('Verify email error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
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

      // Gate coach login behind email verification and admin approval (when enabled)
      if (user.role === 'coach') {
        const requireVerify = process.env.EMAIL_VERIFY === 'true';
        const requireApproval = process.env.APPROVAL_REQUIRED === 'true';
        if (requireVerify && !(user as any).emailVerifiedAt) {
          return res.status(403).json({ message: 'Email not verified. Please check your inbox.' });
        }
        if (requireApproval) {
          const [profile] = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, user.id));
          if (!profile || (profile as any).status !== 'active') {
            return res.status(403).json({ message: 'Your coach account is pending approval.' });
          }
        }
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Log login event (non-blocking)
      logUsage('user_login', { actorType: user.role as any, actorId: user.id }).catch(() => {});

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

  // Admin routes: manage coaches
  app.get("/api/admin/coaches", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const { status, search } = req.query as any;
      const base = db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          profileStatus: coachProfiles.status,
          phone: coachProfiles.phone,
          bio: coachProfiles.bio,
          specialties: coachProfiles.specialties,
          approvedAt: coachProfiles.approvedAt,
          clientsCount: sql<number>`count(${clients.id})`.as('clients_count'),
        })
        .from(users)
        .leftJoin(coachProfiles, eq(coachProfiles.userId, users.id))
        .leftJoin(clients, eq(clients.coachId, users.id))
        .groupBy(
          users.id,
          users.email,
          users.firstName,
          users.lastName,
          users.role,
          coachProfiles.status,
          coachProfiles.phone,
          coachProfiles.bio,
          coachProfiles.specialties,
          coachProfiles.approvedAt,
        )
        .orderBy(desc(users.createdAt));

      const conditions: any[] = [eq(users.role, 'coach' as any)];
      if (status) {
        conditions.push(eq(coachProfiles.status, String(status)));
      }
      if (search) {
        const like = `%${String(search).toLowerCase()}%`;
        conditions.push(sql`LOWER(${users.email}) LIKE ${like} OR LOWER(${users.firstName}) LIKE ${like} OR LOWER(${users.lastName}) LIKE ${like}`);
      }

      const rows = await base.where(and(...conditions));
      return res.json(rows);
    } catch (error: any) {
      console.error('Admin list coaches error:', error?.message || error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/coaches/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const { id } = req.params;
      const [coach] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          profileStatus: coachProfiles.status,
          phone: coachProfiles.phone,
          bio: coachProfiles.bio,
          specialties: coachProfiles.specialties,
          approvedAt: coachProfiles.approvedAt,
          clientsCount: sql<number>`count(${clients.id})`.as('clients_count'),
        })
        .from(users)
        .leftJoin(coachProfiles, eq(coachProfiles.userId, users.id))
        .leftJoin(clients, eq(clients.coachId, users.id))
        .where(eq(users.id, id))
        .groupBy(
          users.id,
          users.email,
          users.firstName,
          users.lastName,
          users.role,
          coachProfiles.status,
          coachProfiles.phone,
          coachProfiles.bio,
          coachProfiles.specialties,
          coachProfiles.approvedAt,
        );
      if (!coach) return res.status(404).json({ message: "Coach not found" });
      return res.json(coach);
    } catch (error: any) {
      console.error('Admin coach detail error:', error?.message || error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin Overview KPIs
  app.get("/api/admin/overview", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const now = new Date();
      const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const since1d = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [{ count: totalCoaches }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'coach' as any));
      const [{ count: pendingCoaches }] = await db.select({ count: sql<number>`count(*)` }).from(coachProfiles).where(eq(coachProfiles.status, 'pending' as any));
      const [{ count: activeCoaches }] = await db.select({ count: sql<number>`count(*)` }).from(coachProfiles).where(eq(coachProfiles.status, 'active' as any));
      const [{ count: suspendedCoaches }] = await db.select({ count: sql<number>`count(*)` }).from(coachProfiles).where(eq(coachProfiles.status, 'suspended' as any));

      const [{ count: totalClients }] = await db.select({ count: sql<number>`count(*)` }).from(clients);
      const [{ count: newClients7d }] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(sql`${clients.createdAt} >= ${since7}`);
      const [{ count: newClients30d }] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(sql`${clients.createdAt} >= ${since30}`);

      const [{ count: workoutsCreated7d }] = await db.select({ count: sql<number>`count(*)` }).from(workouts).where(sql`${workouts.createdAt} >= ${since7}`);
      const [{ count: workoutsCompleted7d }] = await db.select({ count: sql<number>`count(*)` }).from(workouts).where(sql`${workouts.completedAt} >= ${since7}`);

      const [{ count: messages24h }] = await db.select({ count: sql<number>`count(*)` }).from(messages).where(sql`${messages.createdAt} >= ${since1d}`);

      return res.json({
        coaches: {
          total: Number(totalCoaches || 0),
          pending: Number(pendingCoaches || 0),
          active: Number(activeCoaches || 0),
          suspended: Number(suspendedCoaches || 0),
        },
        clients: {
          total: Number(totalClients || 0),
          new7d: Number(newClients7d || 0),
          new30d: Number(newClients30d || 0),
        },
        workouts: {
          created7d: Number(workoutsCreated7d || 0),
          completed7d: Number(workoutsCompleted7d || 0),
        },
        messaging: {
          sent24h: Number(messages24h || 0),
        }
      });
    } catch (error: any) {
      console.error('Admin overview error:', error?.message || error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/coaches/:id", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      if (process.env.ENABLE_ADMIN_MUTATION !== 'true') {
        return res.status(405).json({ message: "Admin mutations disabled" });
      }
      const { id } = req.params;
      const { action, status, bio, specialties, phone } = req.body || {};
      const [existing] = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, id));
      const now = new Date();
      if (!existing) {
        await db.insert(coachProfiles).values({ id: crypto.randomUUID(), userId: id, status: 'pending', createdAt: now, updatedAt: now } as any);
      }
      const prevStatus = (existing as any)?.status || 'pending';
      const next: any = { updatedAt: new Date() };
      if (action === 'approve') {
        next.status = 'active';
        next.approvedAt = new Date();
      } else if (action === 'suspend') {
        next.status = 'suspended';
      } else if (action === 'reactivate') {
        next.status = 'active';
      }
      if (status) next.status = String(status);
      if (bio !== undefined) next.bio = bio;
      if (specialties !== undefined) next.specialties = specialties;
      if (phone !== undefined) next.phone = phone;
      await db.update(coachProfiles).set(next).where(eq(coachProfiles.userId, id));
      const [updated] = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, id));

      // Audit + usage logs
      try {
        const actionName = next.status === 'active' && prevStatus !== 'active' ? (action === 'approve' ? 'coach_approved' : 'coach_reactivated')
          : next.status === 'suspended' ? 'coach_suspended' : 'coach_updated';
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          actorId: req.user.userId,
          action: actionName,
          targetType: 'coach',
          targetId: id,
          meta: { prevStatus, nextStatus: next.status },
          createdAt: new Date(),
        } as any);
        logUsage(actionName, { actorType: 'admin', actorId: req.user.userId, coachId: id, metadata: { prevStatus, nextStatus: next.status } }).catch(() => {});
      } catch (e) {
        console.warn('audit/usage log failed', e);
      }
      return res.json({ ok: true, profile: updated });
    } catch (error: any) {
      console.error('Admin coach update error:', error?.message || error);
      return res.status(500).json({ message: "Internal server error" });
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

      const { includeCompleted, startDate, endDate, clientId, includeDeleted } = req.query;
      
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
      if (includeDeleted !== undefined) {
        options.includeDeleted = includeDeleted === 'true';
      }

      // Get real workouts from database
      const workouts = await storage.getWorkoutsByCoach(req.user.userId, options);
      res.json({ workouts });
    } catch (error) {
      console.error('Get coach workouts error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Restore a soft-deleted workout (coach only, must own)
  app.patch("/api/coach/workouts/:id/restore", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: 'Missing workout id' });

      const existing = await storage.getWorkout(id);
      if (!existing) return res.status(404).json({ message: 'Workout not found' });
      if ((existing as any).coachId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.restoreWorkout(id);
      logUsage('workout_restored', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, clientId: (existing as any).clientId, metadata: { workoutId: id } }).catch(() => {});
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('Restore workout error:', error?.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create client route
  app.post("/api/coach/clients", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { email, firstName, lastName, phone, goals, currentWeight, targetWeight, height, generateTempPassword } = req.body;
      
      if (!email || !firstName || !lastName || !phone) {
        return res.status(400).json({ message: "Email, first name, last name, and phone are required" });
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
          role: 'client',
          phone: phone || null,
        });
      } else if (phone) {
        try { await storage.updateUserProfile(user.id, { phone }); } catch (e) { console.warn('Failed to update user phone', e); }
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
      } as any);

      res.status(201).json({ 
        client: {
          ...client,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: (user as any).phone ?? phone ?? null,
          }
        },
        tempPassword 
      });
      // usage event
      logUsage('client_created', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, clientId: (client as any).id, metadata: { email } }).catch(() => {});
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
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
        updates.phone = req.body.phone;
      }
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
      const userFieldWhitelist = new Set(['email', 'firstName', 'lastName', 'avatar', 'phone']);
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
          phone: (user as any).phone ?? null,
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
      logUsage('workout_created', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, clientId, metadata: { workoutId: (newWorkout as any).id } }).catch(() => {});
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
      logUsage('workout_completed', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, clientId: (completedWorkout as any).clientId, metadata: { workoutId, duration } }).catch(() => {});
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
      logUsage('message_sent', { actorType: req.user.role, actorId: req.user.userId, coachId, clientId, metadata: { length: String(body).length } }).catch(() => {});
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
      logUsage('message_read', { actorType: req.user.role, actorId: req.user.userId, coachId, clientId, metadata: { marked: result.updated } }).catch(() => {});
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
          avatar: (user as any).avatar ?? null,
          phone: (user as any).phone ?? null,
        } : undefined,
      });
    } catch (error: any) {
      console.error('Get client profile error:', error?.message || error);
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
    } catch (error: any) {
      console.error('Get client stats error:', error?.message || error);
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
    } catch (error: any) {
      console.error('Get client progress error:', error?.message || error);
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
      // usage log
      logUsage('broadcast_created', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, metadata: { id: (groupMessage as any).id } }).catch(() => {});
    } catch (error: any) {
      console.error('Create group message error:', error?.message || error);
      res.status(500).json({ message: "Internal server error", error: error?.message });
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
    } catch (error: any) {
      console.error('Get group messages error:', error?.message || error);
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
      logUsage('broadcast_canceled', { actorType: 'coach', actorId: req.user.userId, coachId: req.user.userId, metadata: { id } }).catch(() => {});
    } catch (error: any) {
      console.error('Cancel group message error:', error?.message || error);
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
      logUsage('broadcast_confirmed', { actorType: 'client', actorId: req.user.userId, coachId: client.coachId, clientId: client.id, metadata: { id } }).catch(() => {});
    } catch (error: any) {
      console.error('Confirm group message error:', error?.message || error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return createServer(app);
}
