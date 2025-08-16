import { 
  users, 
  clients, 
  workouts, 
  progressEntries,
  type User, 
  type InsertUser,
  type Client,
  type InsertClient,
  type Workout,
  type InsertWorkout,
  type ProgressEntry,
  type InsertProgressEntry
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Client methods
  getClientsByCoach(coachId: string): Promise<Client[]>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Workout methods
  getWorkoutsByClient(clientId: string): Promise<Workout[]>;
  getWorkoutsByCoach(coachId: string): Promise<Workout[]>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  completeWorkout(workoutId: string, duration: number, notes?: string): Promise<Workout>;
  
  // Progress methods
  getProgressByClient(clientId: string): Promise<ProgressEntry[]>;
  createProgressEntry(entry: InsertProgressEntry): Promise<ProgressEntry>;
  
  // Dashboard stats
  getCoachStats(coachId: string): Promise<{
    totalClients: number;
    activeClients: number;
    completedWorkouts: number;
    avgProgress: number;
  }>;
  
  getClientStats(clientId: string): Promise<{
    totalWorkouts: number;
    completedWorkouts: number;
    progressEntries: number;
    daysActive: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getClientsByCoach(coachId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(and(eq(clients.coachId, coachId), eq(clients.isActive, true)))
      .orderBy(desc(clients.updatedAt));
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async getWorkoutsByClient(clientId: string): Promise<Workout[]> {
    return await db
      .select()
      .from(workouts)
      .where(eq(workouts.clientId, clientId))
      .orderBy(desc(workouts.scheduledDate));
  }

  async getWorkoutsByCoach(coachId: string): Promise<Workout[]> {
    return await db
      .select()
      .from(workouts)
      .where(eq(workouts.coachId, coachId))
      .orderBy(desc(workouts.scheduledDate));
  }

  async createWorkout(insertWorkout: InsertWorkout): Promise<Workout> {
    const [workout] = await db
      .insert(workouts)
      .values(insertWorkout)
      .returning();
    return workout;
  }

  async completeWorkout(workoutId: string, duration: number, notes?: string): Promise<Workout> {
    const [workout] = await db
      .update(workouts)
      .set({
        completedAt: new Date(),
        duration,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(workouts.id, workoutId))
      .returning();
    return workout;
  }

  async getProgressByClient(clientId: string): Promise<ProgressEntry[]> {
    return await db
      .select()
      .from(progressEntries)
      .where(eq(progressEntries.clientId, clientId))
      .orderBy(desc(progressEntries.date));
  }

  async createProgressEntry(insertEntry: InsertProgressEntry): Promise<ProgressEntry> {
    const [entry] = await db
      .insert(progressEntries)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async getCoachStats(coachId: string): Promise<{
    totalClients: number;
    activeClients: number;
    completedWorkouts: number;
    avgProgress: number;
  }> {
    const clientList = await this.getClientsByCoach(coachId);
    const totalClients = clientList.length;
    const activeClients = clientList.filter(c => c.isActive).length;
    
    const allWorkouts = await this.getWorkoutsByCoach(coachId);
    const completedWorkouts = allWorkouts.filter(w => w.completedAt).length;
    
    // Calculate average progress (simplified)
    const avgProgress = totalClients > 0 ? Math.round((completedWorkouts / totalClients) * 10) : 0;
    
    return {
      totalClients,
      activeClients,
      completedWorkouts,
      avgProgress: Math.min(avgProgress, 100),
    };
  }

  async getClientStats(clientId: string): Promise<{
    totalWorkouts: number;
    completedWorkouts: number;
    progressEntries: number;
    daysActive: number;
  }> {
    const allWorkouts = await this.getWorkoutsByClient(clientId);
    const totalWorkouts = allWorkouts.length;
    const completedWorkouts = allWorkouts.filter(w => w.completedAt).length;
    
    const progressList = await this.getProgressByClient(clientId);
    const progressEntries = progressList.length;
    
    // Calculate days active (simplified)
    let daysActive = 0;
    if (progressEntries > 0 && progressList[progressList.length - 1]?.date) {
      const lastEntryDate = progressList[progressList.length - 1].date;
      if (lastEntryDate) {
        daysActive = Math.ceil((Date.now() - new Date(lastEntryDate).getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    
    return {
      totalWorkouts,
      completedWorkouts,
      progressEntries,
      daysActive,
    };
  }
}

export const storage = new DatabaseStorage();
