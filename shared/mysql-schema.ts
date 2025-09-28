import { sql } from "drizzle-orm";
import { mysqlTable, varchar, text, timestamp, int, boolean, json, decimal } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Note: Use varchar(191) for PKs to be friendly with MySQL index limits

export const users = mysqlTable("users", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  userId: varchar("user_id", { length: 191 }).notNull(),
  coachId: varchar("coach_id", { length: 191 }).notNull(),
  goals: json("goals"),
  currentWeight: decimal("current_weight", { precision: 5, scale: 2 }),
  targetWeight: decimal("target_weight", { precision: 5, scale: 2 }),
  height: decimal("height", { precision: 5, scale: 2 }),
  startDate: timestamp("start_date").defaultNow(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workouts = mysqlTable("workouts", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  coachId: varchar("coach_id", { length: 191 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  exercises: json("exercises"),
  scheduledDate: timestamp("scheduled_date"),
  completedAt: timestamp("completed_at"),
  duration: int("duration"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const progressEntries = mysqlTable("progress_entries", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  bodyFat: decimal("body_fat", { precision: 4, scale: 2 }),
  muscleMass: decimal("muscle_mass", { precision: 5, scale: 2 }),
  photos: json("photos"),
  measurements: json("measurements"),
  notes: text("notes"),
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 191 }).primaryKey(),
  coachId: varchar("coach_id", { length: 191 }).notNull(),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  senderId: varchar("sender_id", { length: 191 }).notNull(),
  body: text("body").notNull(),
  groupMessageId: varchar("group_message_id", { length: 191 }),
  createdAt: timestamp("created_at").notNull(),
  readAt: timestamp("read_at"),
});

export const groupMessages = mysqlTable("group_messages", {
  id: varchar("id", { length: 191 }).primaryKey(),
  coachId: varchar("coach_id", { length: 191 }).notNull(),
  title: text("title"),
  body: text("body").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  requireConfirmation: boolean("require_confirmation").default(false),
  audience: text("audience").notNull(),
  workoutId: varchar("workout_id", { length: 191 }),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMessageRecipients = mysqlTable("group_message_recipients", {
  id: varchar("id", { length: 191 }).primaryKey(),
  messageId: varchar("message_id", { length: 191 }).notNull(),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  sentAt: timestamp("sent_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionLogs = mysqlTable("session_logs", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  coachId: varchar("coach_id", { length: 191 }).notNull(),
  workoutId: varchar("workout_id", { length: 191 }),
  performed: json("performed"),
  date: timestamp("date").defaultNow(),
  duration: int("duration"),
  averageRpe: decimal("average_rpe", { precision: 3, scale: 1 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bodyMeasurements = mysqlTable("body_measurements", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  clientId: varchar("client_id", { length: 191 }).notNull(),
  date: timestamp("date").defaultNow(),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  bodyFat: decimal("body_fat", { precision: 4, scale: 2 }),
  muscleMass: decimal("muscle_mass", { precision: 5, scale: 2 }),
  measurements: json("measurements"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workoutSessions = mysqlTable("workout_sessions", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  userId: varchar("user_id", { length: 191 }).notNull(),
  coachId: varchar("coach_id", { length: 191 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workoutEntries = mysqlTable("workout_entries", {
  id: varchar("id", { length: 191 }).primaryKey().default(sql`(uuid())`),
  sessionId: varchar("session_id", { length: 191 }),
  userId: varchar("user_id", { length: 191 }).notNull(),
  coachId: varchar("coach_id", { length: 191 }),
  exercise: text("exercise").notNull(),
  sets: int("sets"),
  reps: int("reps"),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  duration: int("duration"),
  rawText: text("raw_text").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations (optional currently, but can be expanded)
export const usersRelations = relations(users, ({ many }) => ({
  clientProfiles: many(clients),
  workouts: many(workouts),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  coach: one(users, {
    fields: [clients.coachId],
    references: [users.id],
  }),
  workouts: many(workouts),
  progressEntries: many(progressEntries),
}));

// Validation schemas (Zod) similar to existing ones
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });

export const insertClientSchema = createInsertSchema(clients, {
  currentWeight: z.union([z.string(), z.number()]).nullable(),
  targetWeight: z.union([z.string(), z.number()]).nullable(),
  height: z.union([z.string(), z.number()]).nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true, userId: true, coachId: true, startDate: true })
  .extend({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
  });

// Simple, free-text exercise schema: only name and sets/details string
export const exerciseSchema = z.object({
  name: z.string().min(1),
  // "sets" can include any details (e.g., "10 reps, 2 sets" or any free text)
  sets: z.string().min(1),
  // Optional explanation/comment per exercise
  comment: z.string().optional(),
  completed: z.boolean().optional(),
});

export const insertWorkoutSchema = createInsertSchema(workouts, {
  exercises: z.array(exerciseSchema).default([]),
  // Accept ISO string, epoch ms, or Date for scheduledDate
  scheduledDate: z.union([z.string(), z.number(), z.date()]).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertProgressEntrySchema = createInsertSchema(progressEntries).omit({ id: true, createdAt: true });

export const insertMessageSchema = createInsertSchema(messages);
export const insertGroupMessageSchema = createInsertSchema(groupMessages);
export const insertGroupMessageRecipientSchema = createInsertSchema(groupMessageRecipients);
export const insertSessionLogSchema = createInsertSchema(sessionLogs);
export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Types
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
