import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ['coach', 'client'] }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  coachId: text("coach_id").notNull().references(() => users.id),
  goals: text("goals", { mode: 'json' }).$type<Record<string, any>>(),
  currentWeight: real("current_weight"),
  targetWeight: real("target_weight"),
  height: real("height"),
  startDate: integer("start_date", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id),
  coachId: text("coach_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  exercises: text("exercises", { mode: 'json' }).$type<any[]>(),
  scheduledDate: integer("scheduled_date", { mode: 'timestamp' }),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  duration: integer("duration"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const progressEntries = sqliteTable("progress_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id),
  weight: real("weight"),
  bodyFat: real("body_fat"),
  muscleMass: real("muscle_mass"),
  photos: text("photos", { mode: 'json' }).$type<string[]>(),
  measurements: text("measurements", { mode: 'json' }).$type<Record<string, any>>(),
  notes: text("notes"),
  date: integer("date", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Messages between coach and client (thread == coachId+clientId)
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  coachId: text("coach_id").notNull(),
  clientId: text("client_id").notNull(),
  senderId: text("sender_id").notNull(),
  body: text("body").notNull(),
  // Optional link to a group broadcast (used to show title, confirmation, attachments)
  groupMessageId: text("group_message_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  readAt: integer("read_at", { mode: "timestamp" }),
});

export const groupMessages = sqliteTable("group_messages", {
  id: text("id").primaryKey(),
  coachId: text("coach_id").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  requireConfirmation: integer("require_confirmation", { mode: "boolean" }).default(false),
  audience: text("audience").notNull(), // JSON string: {"type": "all"} or {"type": "clients", "ids": ["id1", "id2"]}
  workoutId: text("workout_id"),
  status: text("status").notNull().default("scheduled"), // scheduled, processing, sent, canceled, failed
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const groupMessageRecipients = sqliteTable("group_message_recipients", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  clientId: text("client_id").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Workout session logs (actual results captured quickly by coach)
export const sessionLogs = sqliteTable("session_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id),
  coachId: text("coach_id").notNull().references(() => users.id),
  workoutId: text("workout_id").references(() => workouts.id),
  // performed exercises, e.g. [{ name, sets: [{ reps, weight, rpe }] }]
  performed: text("performed", { mode: 'json' }).$type<any[]>(),
  date: integer("date", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  duration: integer("duration"),
  averageRpe: real("average_rpe"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Body measurements snapshot (more structured than generic progress)
export const bodyMeasurements = sqliteTable("body_measurements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clients.id),
  date: integer("date", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  weight: real("weight"),
  bodyFat: real("body_fat"),
  muscleMass: real("muscle_mass"),
  // standard tape measurements in cm; flexible via JSON
  measurements: text("measurements", { mode: 'json' }).$type<Record<string, any>>(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Workout sessions for voice logging
export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  coachId: text("coach_id").references(() => users.id), // Set when coach logs for client
  startTime: integer("start_time", { mode: 'timestamp' }).notNull(),
  endTime: integer("end_time", { mode: 'timestamp' }),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Individual workout entries from voice logging
export const workoutEntries = sqliteTable("workout_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").references(() => workoutSessions.id),
  userId: text("user_id").notNull().references(() => users.id),
  coachId: text("coach_id").references(() => users.id), // Set when coach logs for client
  exercise: text("exercise").notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: real("weight"),
  duration: integer("duration"), // in minutes
  rawText: text("raw_text").notNull(), // Original voice input
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = typeof workouts.$inferInsert;

export type ProgressEntry = typeof progressEntries.$inferSelect;
export type InsertProgressEntry = typeof progressEntries.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export type SessionLog = typeof sessionLogs.$inferSelect;
export type InsertSessionLog = typeof sessionLogs.$inferInsert;

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type InsertBodyMeasurement = typeof bodyMeasurements.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

export type WorkoutEntry = typeof workoutEntries.$inferSelect;
export type InsertWorkoutEntry = typeof workoutEntries.$inferInsert;

export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroupMessage = typeof groupMessages.$inferInsert;

export type GroupMessageRecipient = typeof groupMessageRecipients.$inferSelect;
export type InsertGroupMessageRecipient = typeof groupMessageRecipients.$inferInsert;

// Export schemas
export const insertUserSchema = createInsertSchema(users);
export const insertClientSchema = createInsertSchema(clients);
export const insertWorkoutSchema = createInsertSchema(workouts);
export const insertGroupMessageSchema = createInsertSchema(groupMessages);
export const insertGroupMessageRecipientSchema = createInsertSchema(groupMessageRecipients);

export const insertProgressEntrySchema = createInsertSchema(progressEntries);

export const insertMessageSchema = createInsertSchema(messages);

export const insertSessionLogSchema = createInsertSchema(sessionLogs);
export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements);

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof loginSchema>;
