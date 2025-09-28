import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ['coach', 'client', 'admin'] }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  phone: varchar("phone"),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  coachId: varchar("coach_id").notNull().references(() => users.id),
  goals: jsonb("goals"),
  currentWeight: decimal("current_weight", { precision: 5, scale: 2 }),
  targetWeight: decimal("target_weight", { precision: 5, scale: 2 }),
  height: decimal("height", { precision: 5, scale: 2 }),
  startDate: timestamp("start_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workouts = pgTable("workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  coachId: varchar("coach_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  exercises: jsonb("exercises").default([]),
  scheduledDate: timestamp("scheduled_date"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in minutes
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const progressEntries = pgTable("progress_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  bodyFat: decimal("body_fat", { precision: 4, scale: 2 }),
  muscleMass: decimal("muscle_mass", { precision: 5, scale: 2 }),
  photos: jsonb("photos"),
  measurements: jsonb("measurements"),
  notes: text("notes"),
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messaging and additional tracking tables (ported from MySQL schema)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  coachId: varchar("coach_id").notNull(),
  clientId: varchar("client_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  body: text("body").notNull(),
  groupMessageId: varchar("group_message_id"),
  createdAt: timestamp("created_at").notNull(),
  readAt: timestamp("read_at"),
});

export const groupMessages = pgTable("group_messages", {
  id: varchar("id").primaryKey(),
  coachId: varchar("coach_id").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  requireConfirmation: boolean("require_confirmation").default(false),
  audience: text("audience").notNull(),
  workoutId: varchar("workout_id"),
  status: varchar("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMessageRecipients = pgTable("group_message_recipients", {
  id: varchar("id").primaryKey(),
  messageId: varchar("message_id").notNull(),
  clientId: varchar("client_id").notNull(),
  sentAt: timestamp("sent_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionLogs = pgTable("session_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  coachId: varchar("coach_id").notNull(),
  workoutId: varchar("workout_id"),
  performed: jsonb("performed"),
  date: timestamp("date").defaultNow(),
  duration: integer("duration"),
  averageRpe: decimal("average_rpe", { precision: 3, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bodyMeasurements = pgTable("body_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  date: timestamp("date").defaultNow(),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  bodyFat: decimal("body_fat", { precision: 4, scale: 2 }),
  muscleMass: decimal("muscle_mass", { precision: 5, scale: 2 }),
  measurements: jsonb("measurements"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workoutSessions = pgTable("workout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  coachId: varchar("coach_id"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workoutEntries = pgTable("workout_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  userId: varchar("user_id").notNull(),
  coachId: varchar("coach_id"),
  exercise: text("exercise").notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  duration: integer("duration"),
  rawText: text("raw_text").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin/Coach management tables
export const coachProfiles = pgTable("coach_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default('pending'), // pending | active | suspended
  bio: text("bio"),
  specialties: jsonb("specialties"),
  phone: varchar("phone"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: varchar("target_id"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics events (append-only)
export const usageEvents = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type"), // admin | coach | client | system
  actorId: varchar("actor_id"),
  coachId: varchar("coach_id"),
  clientId: varchar("client_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clientProfiles: many(clients, { relationName: "userToClient" }),
  coachedClients: many(clients, { relationName: "coachToClient" }),
  workouts: many(workouts),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
    relationName: "userToClient",
  }),
  coach: one(users, {
    fields: [clients.coachId],
    references: [users.id],
    relationName: "coachToClient",
  }),
  workouts: many(workouts),
  progressEntries: many(progressEntries),
}));

export const workoutsRelations = relations(workouts, ({ one }) => ({
  client: one(clients, {
    fields: [workouts.clientId],
    references: [clients.id],
  }),
  coach: one(users, {
    fields: [workouts.coachId],
    references: [users.id],
  }),
}));

export const progressEntriesRelations = relations(progressEntries, ({ one }) => ({
  client: one(clients, {
    fields: [progressEntries.clientId],
    references: [clients.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients, {
  // Accept decimals as string or number from the client
  currentWeight: z.union([z.string(), z.number()]).nullable(),
  targetWeight: z.union([z.string(), z.number()]).nullable(),
  height: z.union([z.string(), z.number()]).nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // These are set by the server
  userId: true,
  coachId: true,
  startDate: true,
}).extend({
  email: z.string().email(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

// Simple, free-text exercise schema: only name and sets/details as free text
export const exerciseSchema = z.object({
  name: z.string().min(1),
  // "sets" here represents any details the coach wants to write (e.g., "10 reps, 2 sets")
  sets: z.string().min(1),
  // Optional explanation/comment per exercise
  comment: z.string().optional(),
  // Keep completed optional for UI toggles if needed; no numeric fields enforced
  completed: z.boolean().optional(),
});

export const insertWorkoutSchema = createInsertSchema(workouts, {
  exercises: z.array(exerciseSchema).default([]),
  // Accept ISO string, epoch ms, or Date for scheduledDate
  scheduledDate: z.union([z.string(), z.number(), z.date()]).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertProgressEntrySchema = createInsertSchema(progressEntries).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Insert schemas for new tables
export const insertMessageSchema = createInsertSchema(messages);
export const insertGroupMessageSchema = createInsertSchema(groupMessages);
export const insertGroupMessageRecipientSchema = createInsertSchema(groupMessageRecipients);
export const insertSessionLogSchema = createInsertSchema(sessionLogs);
export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements);
export const insertCoachProfileSchema = createInsertSchema(coachProfiles);
export const insertEmailVerificationSchema = createInsertSchema(emailVerifications);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const insertUsageEventSchema = createInsertSchema(usageEvents);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type InsertProgressEntry = z.infer<typeof insertProgressEntrySchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type SessionLog = typeof sessionLogs.$inferSelect;
export type InsertSessionLog = typeof sessionLogs.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type InsertBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroupMessage = typeof groupMessages.$inferInsert;
export type GroupMessageRecipient = typeof groupMessageRecipients.$inferSelect;
export type InsertGroupMessageRecipient = typeof groupMessageRecipients.$inferInsert;
export type LoginRequest = z.infer<typeof loginSchema>;
export type CoachProfile = typeof coachProfiles.$inferSelect;
export type InsertCoachProfile = typeof coachProfiles.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = typeof emailVerifications.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;
