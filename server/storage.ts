import { 
  users, 
  clients, 
  workouts, 
  progressEntries,
  messages,
  sessionLogs,
  bodyMeasurements,
  groupMessages,
  groupMessageRecipients,
  type User, 
  type InsertUser,
  type Client,
  type InsertClient,
  type Workout,
  type InsertWorkout,
  type ProgressEntry,
  type InsertProgressEntry,
  type Message,
  type InsertMessage,
  type SessionLog,
  type InsertSessionLog,
  type GroupMessage,
  type InsertGroupMessage,
  type GroupMessageRecipient,
  type InsertGroupMessageRecipient,
  type BodyMeasurement,
  type InsertBodyMeasurement
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { ensureGroupMessagesTables } from "./ensure-group-messages-tables";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserProfile(userId: string, updates: Partial<Pick<User, 'email' | 'firstName' | 'lastName' | 'avatar'>>): Promise<User>;
  
  // Client methods
  getClientsByCoach(
    coachId: string, 
    options?: { 
      limit?: number; 
      offset?: number;
      isActive?: boolean;
      searchTerm?: string;
    }): Promise<{ clients: Client[]; total: number }>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  getClient(clientId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(clientId: string, updates: Partial<InsertClient>): Promise<Client>;
  deleteClient(clientId: string): Promise<void>;
  
  // Workout methods
  getWorkout(workoutId: string): Promise<Workout | undefined>;
  getWorkoutsByClient(clientId: string): Promise<Workout[]>;
  getWorkoutsByCoach(coachId: string, options?: { startDate?: Date; endDate?: Date }): Promise<Workout[]>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  completeWorkout(workoutId: string, duration: number, notes?: string): Promise<Workout>;
  
  // Progress methods
  getProgressByClient(clientId: string): Promise<ProgressEntry[]>;
  createProgressEntry(entry: InsertProgressEntry): Promise<ProgressEntry>;

  // Session logs
  getSessionLogsByClient(clientId: string): Promise<SessionLog[]>;
  createSessionLog(entry: InsertSessionLog): Promise<SessionLog>;

  // Body measurements
  getBodyMeasurementsByClient(clientId: string): Promise<BodyMeasurement[]>;
  createBodyMeasurement(entry: InsertBodyMeasurement): Promise<BodyMeasurement>;
  
  // Messaging methods
  getMessagesByThread(coachId: string, clientId: string, options?: { limit?: number }): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesReadInThread(coachId: string, clientId: string, readerUserId: string): Promise<{ updated: number }>;
  
  // Dashboard stats
  getCoachStats(coachId: string): Promise<{
    totalClients: number;
    activeClients: number;
    completedWorkouts: number;
    avgProgress: number;
    recentWorkouts: any[];
    upcomingWorkouts: any[];
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

  async getRecentClientFeedbackByCoach(coachId: string, limit: number = 20): Promise<{
    id: string;
    clientId: string;
    clientName: string;
    body: string;
    createdAt: Date;
    readAt: Date | null;
    workoutId?: string | null;
  }[]> {
    try {
      const rows = await db
        .select({
          id: messages.id,
          clientId: messages.clientId,
          body: messages.body,
          createdAt: messages.createdAt,
          readAt: messages.readAt,
          groupMessageId: (messages as any).groupMessageId,
          userFirst: users.firstName,
          userLast: users.lastName,
          userEmail: users.email,
        })
        .from(messages)
        .leftJoin(clients, eq(messages.clientId, clients.id))
        .leftJoin(users, eq(users.id, clients.userId))
        .where(and(
          eq(messages.coachId, coachId),
          sql`${messages.senderId} <> ${coachId}`
        ))
        .orderBy(desc(messages.createdAt))
        .limit(Math.max(1, Math.min(200, limit)));

      return rows.map((r: any) => {
        const created = r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt) || Date.now());
        const read = r.readAt ? (r.readAt instanceof Date ? r.readAt : new Date(Number(r.readAt))) : null;
        const name = [r.userFirst, r.userLast].filter(Boolean).join(' ') || r.userEmail || 'Client';
        return {
          id: r.id,
          clientId: r.clientId,
          clientName: name,
          body: r.body,
          createdAt: created,
          readAt: read,
          workoutId: null,
        };
      });
    } catch (error) {
      console.error('Error in getRecentClientFeedbackByCoach:', error);
      return [];
    }
  }

  async markMessagesReadInThread(coachId: string, clientId: string, readerUserId: string): Promise<{ updated: number }> {
    try {
      const now = new Date();
      // Update only messages in the thread, that are unread, and not sent by the reader
      const result = await db
        .update(messages)
        .set({ readAt: now })
        .where(and(
          eq(messages.coachId, coachId),
          eq(messages.clientId, clientId),
          isNull(messages.readAt),
          sql`${messages.senderId} <> ${readerUserId}`
        ));

      // drizzle better-sqlite3 update doesn't return affectedRows, but we can attempt a count afterwards
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.coachId, coachId),
          eq(messages.clientId, clientId),
          isNull(messages.readAt),
          sql`${messages.senderId} <> ${readerUserId}`
        ));

      // We cannot get exact updated; return best-effort as previous unread (heuristic)
      // To avoid confusion, try to compute updated by comparing before/after would require transaction; keep simple
      return { updated: Number.isFinite(count) ? count : 0 };
    } catch (error) {
      console.error('Error in markMessagesReadInThread:', error);
      throw new Error(`Failed to mark messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionLogsByClient(clientId: string): Promise<SessionLog[]> {
    try {
      const rows = await db
        .select()
        .from(sessionLogs)
        .where(eq(sessionLogs.clientId, clientId))
        .orderBy(desc(sessionLogs.date));

      return rows.map((r: any) => ({
        ...r,
        performed: Array.isArray(r.performed)
          ? r.performed
          : (typeof r.performed === 'string' ? (() => { try { return JSON.parse(r.performed); } catch { return []; } })() : []),
        date: r.date instanceof Date ? r.date : new Date(Number(r.date) || Date.now()),
        createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt) || Date.now()),
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('no such table') && msg.includes('session_logs')) {
        console.warn('session_logs table missing; returning empty list');
        return [];
      }
      console.error('Error in getSessionLogsByClient:', error);
      throw new Error(`Failed to fetch session logs: ${msg}`);
    }
  }

  async createSessionLog(insertEntry: InsertSessionLog): Promise<SessionLog> {
    try {
      const now = Date.now();
      const values: any = {
        ...insertEntry,
        performed: Array.isArray(insertEntry.performed) ? insertEntry.performed : [],
        date: insertEntry.date instanceof Date ? insertEntry.date : new Date(insertEntry.date ?? now),
        createdAt: new Date(now),
      };
      Object.keys(values).forEach(k => values[k] === undefined && delete values[k]);
      // MySQL does not support returning(); generate id and reselect
      const id = (values.id as string) || randomUUID();
      values.id = id;
      await db.insert(sessionLogs).values(values);
      const [row] = await db.select().from(sessionLogs).where(eq(sessionLogs.id, id));
      const safe = row as any;
      return {
        ...safe,
        performed: Array.isArray(safe.performed) ? safe.performed : (typeof safe.performed === 'string' ? JSON.parse(safe.performed) : []),
        date: safe.date instanceof Date ? safe.date : new Date(Number(safe.date) || now),
        createdAt: safe.createdAt instanceof Date ? safe.createdAt : new Date(Number(safe.createdAt) || now),
      } as SessionLog;
    } catch (error) {
      console.error('Error in createSessionLog:', error);
      throw new Error(`Failed to create session log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBodyMeasurementsByClient(clientId: string): Promise<BodyMeasurement[]> {
    try {
      const rows = await db
        .select()
        .from(bodyMeasurements)
        .where(eq(bodyMeasurements.clientId, clientId))
        .orderBy(desc(bodyMeasurements.date));

      return rows.map((r: any) => ({
        ...r,
        date: r.date instanceof Date ? r.date : new Date(Number(r.date) || Date.now()),
        createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt) || Date.now()),
        measurements: r.measurements && typeof r.measurements === 'string' ? (() => { try { return JSON.parse(r.measurements); } catch { return {}; } })() : (r.measurements || {}),
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('no such table') && msg.includes('body_measurements')) {
        console.warn('body_measurements table missing; returning empty list');
        return [];
      }
      console.error('Error in getBodyMeasurementsByClient:', error);
      throw new Error(`Failed to fetch body measurements: ${msg}`);
    }
  }

  async createBodyMeasurement(insertEntry: InsertBodyMeasurement): Promise<BodyMeasurement> {
    try {
      const now = Date.now();
      const values: any = {
        ...insertEntry,
        measurements: insertEntry.measurements ?? {},
        date: insertEntry.date instanceof Date ? insertEntry.date : new Date(insertEntry.date ?? now),
        createdAt: new Date(now),
      };
      Object.keys(values).forEach(k => values[k] === undefined && delete values[k]);
      const id = (values.id as string) || randomUUID();
      values.id = id;
      await db.insert(bodyMeasurements).values(values);
      const [row] = await db.select().from(bodyMeasurements).where(eq(bodyMeasurements.id, id));
      const safe = row as any;
      return {
        ...safe,
        date: safe.date instanceof Date ? safe.date : new Date(Number(safe.date) || now),
        createdAt: safe.createdAt instanceof Date ? safe.createdAt : new Date(Number(safe.createdAt) || now),
        measurements: safe.measurements && typeof safe.measurements === 'string' ? (() => { try { return JSON.parse(safe.measurements); } catch { return {}; } })() : (safe.measurements || {}),
      } as BodyMeasurement;
    } catch (error) {
      console.error('Error in createBodyMeasurement:', error);
      throw new Error(`Failed to create body measurement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Messaging
  async getMessagesByThread(coachId: string, clientId: string, options: { limit?: number } = {}): Promise<Message[]> {
    try {
      let query = db
        .select()
        .from(messages)
        .where(and(eq(messages.coachId, coachId), eq(messages.clientId, clientId)))
        .orderBy(desc(messages.createdAt));

      if (options.limit && options.limit > 0) {
        query = query.limit(options.limit);
      }

      const rows = await query;

      // Enrich with optional broadcast metadata (title, requiresConfirmation, confirmedAt, workout)
      const enriched: any[] = [];
      for (const m of rows) {
        const base = {
          ...m,
          createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(Number(m.createdAt) || Date.now()),
          readAt: m.readAt ? (m.readAt instanceof Date ? m.readAt : new Date(Number(m.readAt))) : null,
        } as any;

        if ((m as any).groupMessageId) {
          try {
            const [gm] = await db.select().from(groupMessages).where(eq(groupMessages.id, (m as any).groupMessageId));
            if (gm) {
              base.groupMessageTitle = gm.title ?? null;
              base.requiresConfirmation = Boolean(gm.requireConfirmation);
              base.workoutId = gm.workoutId ?? null;

              // Recipient confirmation state for this client
              const [gmr] = await db
                .select()
                .from(groupMessageRecipients)
                .where(and(eq(groupMessageRecipients.messageId, gm.id), eq(groupMessageRecipients.clientId, clientId)));
              base.confirmedAt = gmr?.confirmedAt ?? null;

              // Optional workout name for nicer UI
              if (gm.workoutId) {
                const [w] = await db.select().from(workouts).where(eq(workouts.id, gm.workoutId));
                if (w) base.workoutName = w.name;
              }
            }
          } catch (e) {
            console.warn('Failed to enrich message with group metadata:', e);
          }
        }

        enriched.push(base);
      }

      return enriched as Message[];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('no such table') && msg.includes('messages')) {
        console.warn('messages table missing; returning empty thread');
        return [];
      }
      console.error('Error in getMessagesByThread:', error);
      throw new Error(`Failed to fetch messages: ${msg}`);
    }
  }

  async createMessage(messageInput: InsertMessage): Promise<Message> {
    try {
      const now = new Date();
      const values: any = {
        ...messageInput,
        createdAt: now,
      };

      Object.keys(values).forEach(k => values[k] === undefined && delete values[k]);
      const id = (values.id as string) || randomUUID();
      values.id = id;
      await db.insert(messages).values(values);
      const [row] = await db.select().from(messages).where(eq(messages.id, id));
      const safe = row as any;
      return {
        ...safe,
        createdAt: safe.createdAt instanceof Date ? safe.createdAt : new Date(Number(safe.createdAt) || now.getTime()),
        readAt: safe.readAt ? (safe.readAt instanceof Date ? safe.readAt : new Date(Number(safe.readAt))) : null,
      } as Message;
    } catch (error) {
      console.error('Error in createMessage:', error);
      throw new Error(`Failed to create message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = (insertUser as any).id || randomUUID();
    await db.insert(users).values({ ...(insertUser as any), id });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, updates: Partial<Pick<User, 'email' | 'firstName' | 'lastName' | 'avatar'>>): Promise<User> {
    const payload: any = {};
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.firstName !== undefined) payload.firstName = updates.firstName as any;
    if (updates.lastName !== undefined) payload.lastName = updates.lastName as any;
    if ((updates as any).avatar !== undefined) payload.avatar = (updates as any).avatar;
    payload.updatedAt = new Date();

    await db
      .update(users)
      .set(payload)
      .where(eq(users.id, userId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user as User;
  }

  async getClientsByCoach(
    coachId: string, 
    options: { 
      limit?: number; 
      offset?: number;
      isActive?: boolean;
      searchTerm?: string;
    } = {}
  ): Promise<{ clients: Client[]; total: number }> {
    type ClientWithUser = Client & {
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        avatar: string | null;
      } | null;
      isActive: boolean;
    };
    try {
      console.log(`Fetching clients for coach ${coachId}`, options);
      
      // Start building the base query
      let queryBuilder = db
        .select({
          id: clients.id,
          userId: clients.userId,
          coachId: clients.coachId,
          goals: clients.goals,
          currentWeight: clients.currentWeight,
          targetWeight: clients.targetWeight,
          height: clients.height,
          startDate: clients.startDate,
          isActive: clients.isActive,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.avatar,
          }
        })
        .from(clients)
        .leftJoin(users, eq(users.id, clients.userId));

      // Build combined WHERE conditions to avoid overwriting previous filters
      const conditions: any[] = [eq(clients.coachId, coachId)];
      if (options.isActive !== undefined) {
        conditions.push(eq(clients.isActive, Boolean(options.isActive)));
      }
      if (options.searchTerm) {
        const searchTerm = `%${options.searchTerm.toLowerCase()}%`;
        conditions.push(sql`LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE ${searchTerm}`);
      }
      if (conditions.length > 0) {
        // Combine with AND
        queryBuilder = queryBuilder.where(and(...conditions));
      }
      
      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(queryBuilder.as('filtered_clients'));
      
      const total = countResult[0]?.count || 0;
      
      // Apply sorting and pagination to the main query
      queryBuilder = queryBuilder.orderBy(desc(clients.updatedAt));
      
      if (options.limit !== undefined) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      
      if (options.offset !== undefined) {
        queryBuilder = queryBuilder.offset(options.offset);
      }
      
      const queryResults = await queryBuilder;
      
      // Map the results to the expected format
      const clientsList: ClientWithUser[] = queryResults.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        coachId: row.coachId,
        goals: row.goals,
        currentWeight: row.currentWeight,
        targetWeight: row.targetWeight,
        height: row.height,
        startDate: row.startDate,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: row.user ? {
          id: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          avatar: row.user.avatar,
        } : null
      }));
      
      console.log(`Found ${clientsList.length} of ${total} clients for coach ${coachId}`);
      
      return { clients: clientsList, total };
    } catch (error) {
      console.error('Error in getClientsByCoach:', error);
      throw new Error(`Failed to fetch clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    try {
      console.log(`[storage] Fetching client with user ID: ${userId}`);
      
      const [result] = await db
        .select()
        .from(clients)
        .leftJoin(users, eq(users.id, clients.userId))
        .where(eq(clients.userId, userId));
      
      if (!result?.clients) {
        console.log(`[storage] No client found for user ID: ${userId}`);
        return undefined;
      }
      
      const client = {
        ...result.clients,
        user: result.users ? {
          id: result.users.id,
          email: result.users.email,
          firstName: result.users.firstName,
          lastName: result.users.lastName,
          avatar: result.users.avatar,
        } : null,
        isActive: Boolean(result.clients.isActive)
      };
      
      console.log(`[storage] Found client for user ID ${userId}:`, client);
      return client;
    } catch (error) {
      console.error(`[storage] Error fetching client for user ID ${userId}:`, error);
      throw new Error(`Failed to fetch client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClient(clientId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));
    
    if (!client) return undefined;
    
    // Ensure isActive is a boolean for the frontend
    return {
      ...client,
      isActive: Boolean(client.isActive)
    };
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = (insertClient as any).id || randomUUID();
    await db.insert(clients).values({ ...(insertClient as any), id });
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client as Client;
  }

  async updateClient(clientId: string, updates: Partial<InsertClient>): Promise<Client> {
    await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    return client as Client;
  }

  async deleteClient(clientId: string): Promise<void> {
    await db
      .update(clients)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  }

  async getWorkout(workoutId: string): Promise<Workout | undefined> {
    try {
      const [workout] = await db
        .select()
        .from(workouts)
        .where(eq(workouts.id, workoutId));
      
      if (!workout) return undefined;
      
      return this.processWorkout(workout);
    } catch (error) {
      console.error('Error in getWorkout:', error);
      throw new Error(`Failed to fetch workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private processWorkout(workout: any): Workout {
    // Ensure exercises is an array
    let exercises: any[] = [];
    try {
      exercises = Array.isArray(workout.exercises)
        ? workout.exercises
        : (typeof workout.exercises === 'string' 
            ? JSON.parse(workout.exercises) 
            : []);
    } catch (error) {
      console.error('Error parsing exercises:', error);
      exercises = [];
    }
    
    // Convert to Date objects robustly and ALWAYS return a Date
    const toDate = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp === 'number') return new Date(timestamp);
      const num = Number(timestamp);
      if (!Number.isNaN(num)) return new Date(num);
      const d = new Date(timestamp);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    };
    
    // Ensure all required fields are present with proper types
    const processedWorkout: Workout = {
      ...workout,
      exercises,
      scheduledDate: toDate(workout.scheduledDate),
      completedAt: toDate(workout.completedAt),
      createdAt: toDate(workout.createdAt) || new Date(),
      updatedAt: toDate(workout.updatedAt) || new Date()
    };

    // Ensure all date fields are valid Date objects or null
    if (processedWorkout.scheduledDate && isNaN(processedWorkout.scheduledDate.getTime())) {
      processedWorkout.scheduledDate = null;
    }
    if (processedWorkout.completedAt && isNaN(processedWorkout.completedAt.getTime())) {
      processedWorkout.completedAt = null;
    }
    if (isNaN((processedWorkout.createdAt as Date).getTime())) {
      processedWorkout.createdAt = new Date();
    }
    if (isNaN((processedWorkout.updatedAt as Date).getTime())) {
      processedWorkout.updatedAt = new Date();
    }

    return processedWorkout;
  }

  async getWorkoutsByClient(clientId: string, options: { limit?: number; includeCompleted?: boolean } = {}): Promise<Workout[]> {
    try {
      console.log(`[storage] Fetching workouts for client ${clientId} with options:`, options);
      
      const conditions = [eq(workouts.clientId, clientId)];
      if (options.includeCompleted === false) {
        conditions.push(isNull(workouts.completedAt));
      }

      let query = db
        .select()
        .from(workouts)
        .where(and(...conditions));
      
      // Apply sorting and limit
      query = query.orderBy(desc(workouts.scheduledDate));
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const results = await query;
      console.log(`[storage] Found ${results.length} workouts for client ${clientId}.`);
      if(results.length > 0) {
        console.log('[storage] First workout result:', results[0]);
      }
      
      // Process each workout to ensure proper types
      return results.map((workout: any) => this.processWorkout(workout));
    } catch (error) {
      console.error('[storage] Error in getWorkoutsByClient:', error);
      throw new Error(`Failed to fetch workouts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWorkoutsByCoach(
    coachId: string, 
    options: { 
      limit?: number; 
      includeCompleted?: boolean;
      clientId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<Workout[]> {
    try {
      console.log(`Fetching workouts for coach ${coachId}`, options);
      
      // Start building the query
      let query = db
        .select()
        .from(workouts)
        .where(eq(workouts.coachId, coachId));
      
      // Apply additional filters if provided
      if (options.includeCompleted === false) {
        query = query.where(isNull(workouts.completedAt));
      }
      
      if (options.clientId) {
        query = query.where(eq(workouts.clientId, options.clientId));
      }
      
      if (options.startDate) {
        query = query.where(sql`${workouts.scheduledDate} >= ${options.startDate}`);
      }
      
      if (options.endDate) {
        query = query.where(sql`${workouts.scheduledDate} <= ${options.endDate}`);
      }
      
      // Apply sorting and limit
      query = query.orderBy(desc(workouts.scheduledDate));
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const results = await query;
      console.log(`Found ${results.length} workouts for coach ${coachId}`);
      
      // Process each workout to ensure proper types
      return results.map(workout => this.processWorkout(workout));
    } catch (error) {
      console.error('Error in getWorkoutsByCoach:', error);
      throw new Error(`Failed to fetch workouts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createWorkout(insertWorkout: InsertWorkout): Promise<Workout> {
    try {
      console.log('Inserting workout with data:', JSON.stringify(insertWorkout, null, 2));
      
      // Ensure required fields
      if (!insertWorkout.clientId || !insertWorkout.coachId) {
        throw new Error('Missing required fields: clientId and coachId are required');
      }

      // For SQLite columns with mode: 'timestamp', Drizzle expects Date objects
      const toDateValue = (value: any): Date | null => {
        if (!value) return null;
        try {
          if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
          if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
          }
          if (typeof value === 'object' && typeof (value as any).getTime === 'function') {
            const t = (value as any).getTime();
            return typeof t === 'number' ? new Date(t) : null;
          }
          const d = new Date(value);
          return isNaN(d.getTime()) ? null : d;
        } catch (e) {
          console.error('toDateValue conversion error for value:', value, e);
          return null;
        }
      };

      // Prepare the workout data with proper types for SQLite
      const now = new Date();
      console.log('Types before date conversion:', {
        scheduledDate: insertWorkout?.scheduledDate && typeof insertWorkout.scheduledDate,
        completedAt: insertWorkout?.completedAt && typeof insertWorkout.completedAt,
      });
      const workoutData: any = {
        ...insertWorkout,
        // Pass JSON value directly; Drizzle will serialize for JSON mode columns
        exercises: Array.isArray(insertWorkout.exercises) ? insertWorkout.exercises : [],
        // Convert to Date objects for SQLite timestamp columns
        scheduledDate: toDateValue(insertWorkout.scheduledDate),
        completedAt: toDateValue(insertWorkout.completedAt),
        createdAt: now,
        updatedAt: now
      };
      
      // Remove any undefined values to avoid SQL errors
      Object.keys(workoutData).forEach(key => {
        if (workoutData[key] === undefined) {
          delete workoutData[key];
        }
      });

      console.log('Prepared workout data for DB:', JSON.stringify(workoutData, null, 2));

      const id = (workoutData as any).id || randomUUID();
      workoutData.id = id;
      await db.insert(workouts).values(workoutData);
      const [workout] = await db.select().from(workouts).where(eq(workouts.id, id));
      console.log('Successfully created workout:', workout);
      return this.processWorkout(workout);
    } catch (error) {
      console.error('Error in createWorkout:', error);
      throw new Error(`Failed to create workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async completeWorkout(workoutId: string, duration: number, notes?: string): Promise<Workout> {
    try {
      console.log(`Completing workout ${workoutId} with duration ${duration} and notes: ${notes}`);
      
      const now = new Date();
      const updateData: any = {
        completedAt: now,
        duration: Number(duration) || 0,
        updatedAt: now,
      };
      
      // Only include notes if provided
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      
      console.log('Updating workout with data:', JSON.stringify(updateData, null, 2));
      
      await db
        .update(workouts)
        .set(updateData)
        .where(eq(workouts.id, workoutId));
      const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId));
      if (!workout) {
        throw new Error('Workout not found');
      }
      
      console.log('Successfully updated workout:', workout);
      return this.processWorkout(workout);
    } catch (error) {
      console.error('Error in completeWorkout:', error);
      throw new Error(`Failed to complete workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProgressByClient(clientId: string): Promise<ProgressEntry[]> {
    try {
      const results = await db
        .select()
        .from(progressEntries)
        .where(eq(progressEntries.clientId, clientId))
        .orderBy(desc(progressEntries.date));
      
      // Process each entry to ensure proper date handling across drivers
      return results.map((entry: any) => {
        const toDate = (v: any) => v instanceof Date ? v : (typeof v === 'number' ? new Date(v) : (v ? new Date(v) : new Date()));
        const photos = typeof entry.photos === 'string' ? (()=>{ try{return JSON.parse(entry.photos)}catch{return []} })() : (Array.isArray(entry.photos) ? entry.photos : []);
        const measurements = typeof entry.measurements === 'string' ? (()=>{ try{return JSON.parse(entry.measurements)}catch{return {}} })() : (entry.measurements || {});
        return {
          ...entry,
          date: toDate(entry.date),
          createdAt: toDate(entry.createdAt),
          photos,
          measurements,
        };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Gracefully handle missing table during development/bootstrap
      if (msg.includes('no such table') && msg.includes('progress_entries')) {
        console.warn('progress_entries table missing; returning empty progress list');
        return [];
      }
      console.error('Error in getProgressByClient:', error);
      throw new Error(`Failed to fetch progress entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createProgressEntry(insertEntry: InsertProgressEntry): Promise<ProgressEntry> {
    try {
      console.log('Creating progress entry with data:', JSON.stringify(insertEntry, null, 2));
      
      // Prepare the entry data with proper types for MySQL
      const now = Date.now();
      const id = (insertEntry as any).id || randomUUID();
      const entryData: any = {
        ...insertEntry,
        id,
        photos: Array.isArray(insertEntry.photos) ? insertEntry.photos : [],
        measurements: insertEntry.measurements && typeof insertEntry.measurements === 'object' ? insertEntry.measurements : {},
        date: insertEntry.date instanceof Date ? insertEntry.date : new Date(insertEntry.date ?? now),
        createdAt: new Date(now),
      };
      Object.keys(entryData).forEach(k => entryData[k] === undefined && delete entryData[k]);
      await db.insert(progressEntries).values(entryData);
      const [row] = await db.select().from(progressEntries).where(eq(progressEntries.id, id));
      const e: any = row;
      return {
        ...e,
        date: e.date instanceof Date ? e.date : new Date(Number(e.date) || now),
        createdAt: e.createdAt instanceof Date ? e.createdAt : new Date(Number(e.createdAt) || now),
        photos: Array.isArray(e.photos) ? e.photos : (typeof e.photos === 'string' ? (()=>{ try{return JSON.parse(e.photos)}catch{return []}})() : []),
        measurements: e.measurements && typeof e.measurements === 'object' ? e.measurements : (typeof e.measurements === 'string' ? (()=>{ try{return JSON.parse(e.measurements)}catch{return {}}})() : {}),
      } as ProgressEntry;
    } catch (error) {
      console.error('Error in createProgressEntry:', error);
      throw new Error(`Failed to create progress entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCoachStats(coachId: string): Promise<{
    totalClients: number;
    activeClients: number;
    completedWorkouts: number;
    avgProgress: number;
    recentWorkouts: Workout[];
    upcomingWorkouts: Workout[];
  }> {
    try {
      console.log(`Fetching stats for coach ${coachId}`);
      
      // Get active clients
      const { clients: allClients } = await this.getClientsByCoach(coachId, { isActive: true });
      const totalClients = allClients.length;
      const activeClients = allClients.filter(c => c.isActive).length;
      
      // Get all workouts for the coach (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allWorkouts = await this.getWorkoutsByCoach(coachId, { 
        includeCompleted: true,
        startDate: thirtyDaysAgo
      });
      
      const completedWorkouts = allWorkouts.filter(w => w.completedAt).length;
      
      // Calculate average progress based on actual client data
      let totalProgress = 0;
      let clientsWithProgress = 0;
      
      for (const client of allClients) {
        const clientWorkouts = await this.getWorkoutsByClient(client.id);
        const clientCompleted = clientWorkouts.filter(w => w.completedAt).length;
        const clientTotal = clientWorkouts.length;
        
        if (clientTotal > 0) {
          const clientProgress = (clientCompleted / clientTotal) * 100;
          totalProgress += clientProgress;
          clientsWithProgress++;
        }
      }
      
      const avgProgress = clientsWithProgress > 0 ? Math.round(totalProgress / clientsWithProgress) : 0;
      
      // Get recent and upcoming workouts
      const now = new Date();
      
      // Get recent completed workouts (last 30 days)
      const recentWorkouts = allWorkouts
        .filter((w: Workout) => w.completedAt && w.completedAt >= thirtyDaysAgo)
        .sort((a: Workout, b: Workout) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
        .slice(0, 5);
      
      // Get upcoming scheduled workouts
      const upcomingWorkouts = allWorkouts
        .filter((w: Workout) => !w.completedAt && w.scheduledDate && w.scheduledDate >= now)
        .sort((a: Workout, b: Workout) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0))
        .slice(0, 5);
      
      console.log(`Found ${totalClients} clients, ${completedWorkouts} completed workouts, and ${upcomingWorkouts.length} upcoming workouts`);
      
      return {
        totalClients,
        activeClients,
        completedWorkouts,
        avgProgress,
        recentWorkouts,
        upcomingWorkouts
      };
    } catch (error) {
      console.error('Error in getCoachStats:', error);
      return {
        totalClients: 0,
        activeClients: 0,
        completedWorkouts: 0,
        avgProgress: 0,
        recentWorkouts: [],
        upcomingWorkouts: []
      };
    }
  }

  async getClientStats(clientId: string): Promise<{
    totalWorkouts: number;
    completedWorkouts: number;
    progressEntries: number;
    daysActive: number;
    lastWorkoutDate: Date | null;
    nextWorkoutDate: Date | null;
    weightChange: number | null;
    bodyFatChange: number | null;
    muscleMassChange: number | null;
  }> {
    try {
      console.log(`Fetching stats for client ${clientId}`);
      
      // Get all workouts for the client
      const allWorkouts = await this.getWorkoutsByClient(clientId);
      const totalWorkouts = allWorkouts.length;
      const completedWorkouts = allWorkouts.filter(w => w.completedAt).length;
      
      // Get all progress entries
      const progressList = await this.getProgressByClient(clientId);
      const progressEntries = progressList.length;
      
      // Calculate days active (number of unique days with at least one completed workout)
      const workoutDays = new Set<string>();
      allWorkouts
        .filter(w => w.completedAt)
        .forEach(w => {
          if (w.completedAt) {
            workoutDays.add(w.completedAt.toISOString().split('T')[0]);
          }
        });
      
      // Get last and next workout dates
      const now = new Date();
      const lastWorkout = allWorkouts
        .filter(w => w.completedAt)
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];
      
      const nextWorkout = allWorkouts
        .filter(w => w.scheduledDate && !w.completedAt && w.scheduledDate > now)
        .sort((a, b) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0))[0];
      
      // Calculate changes in metrics (weight, body fat, muscle mass)
      let weightChange: number | null = null;
      let bodyFatChange: number | null = null;
      let muscleMassChange: number | null = null;
      
      if (progressList.length >= 2) {
        const sortedProgress = [...progressList].sort((a, b) => 
          (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
        );
        
        const first = sortedProgress[0];
        const last = sortedProgress[sortedProgress.length - 1];
        
        if (first.weight && last.weight) {
          weightChange = Number(last.weight) - Number(first.weight);
        }
        
        if (first.bodyFat && last.bodyFat) {
          bodyFatChange = Number(last.bodyFat) - Number(first.bodyFat);
        }
        
        if (first.muscleMass && last.muscleMass) {
          muscleMassChange = Number(last.muscleMass) - Number(first.muscleMass);
        }
      }
      // Calculate days active based on first and last workout dates
      let daysActive = 0;
      if (allWorkouts.length > 0) {
        const sortedWorkouts = [...allWorkouts].sort((a, b) => 
          (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0)
        );
        
        const firstWorkout = sortedWorkouts.find(w => w.completedAt);
        const lastWorkout = [...sortedWorkouts].reverse().find(w => w.completedAt);
        
        if (firstWorkout?.completedAt && lastWorkout?.completedAt) {
          const diffTime = Math.abs(lastWorkout.completedAt.getTime() - firstWorkout.completedAt.getTime());
          daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
        }
      }
      
      // Prepare the result with all calculated statistics
      return {
        totalWorkouts,
        completedWorkouts,
        progressEntries,
        daysActive: Math.max(1, daysActive), // At least 1 day active
        lastWorkoutDate: lastWorkout?.completedAt || null,
        nextWorkoutDate: nextWorkout?.scheduledDate || null,
        weightChange,
        bodyFatChange,
        muscleMassChange
      };
    } catch (error) {
      console.error('Error in getClientStats:', error);
      return {
        totalWorkouts: 0,
        completedWorkouts: 0,
        progressEntries: 0,
        daysActive: 1,
        lastWorkoutDate: null,
        nextWorkoutDate: null,
        weightChange: null,
        bodyFatChange: null,
        muscleMassChange: null
      };
    }
  }

  // Group Messages methods
  async createGroupMessage(data: {
    coachId: string;
    title?: string | null;
    body: string;
    scheduledAt: Date;
    audience: string;
    requireConfirmation: boolean;
    workoutId?: string | null;
    status: string;
  }) {
    console.log('createGroupMessage called with data:', JSON.stringify(data, null, 2));

    const id = randomUUID();
    const now = new Date();
    const insertData = {
      id,
      coachId: data.coachId,
      title: data.title,
      body: data.body,
      scheduledAt: data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt),
      requireConfirmation: data.requireConfirmation,
      audience: data.audience,
      workoutId: data.workoutId,
      status: data.status,
      createdAt: now,
      updatedAt: now,
    };

    console.log('About to insert data:', JSON.stringify(insertData, null, 2));

    await db.insert(groupMessages).values(insertData as any);
    const [row] = await db.select().from(groupMessages).where(eq(groupMessages.id, id));
    return row as any;
  }

  async getGroupMessagesByCoach(coachId: string, options: { status?: string; limit?: number } = {}) {
    let query = db.select().from(groupMessages).where(eq(groupMessages.coachId, coachId));

    if (options.status) {
      query = query.where(eq(groupMessages.status, options.status));
    }

    query = query.orderBy(desc(groupMessages.scheduledAt));

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  async cancelGroupMessage(id: string, coachId: string) {
    await db.update(groupMessages)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(and(eq(groupMessages.id, id), eq(groupMessages.coachId, coachId)));
  }

  async sendGroupMessageNow(id: string, coachId: string) {
    await db.update(groupMessages)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(groupMessages.id, id), eq(groupMessages.coachId, coachId)));
  }

  async confirmGroupMessage(messageId: string, clientId: string) {
    await db.update(groupMessageRecipients)
      .set({ confirmedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(groupMessageRecipients.messageId, messageId), eq(groupMessageRecipients.clientId, clientId)));
  }

  async getDueGroupMessages() {
    const now = new Date();
    return await db.select().from(groupMessages)
      .where(and(
        eq(groupMessages.status, 'scheduled'),
        sql`${groupMessages.scheduledAt} <= ${now}`
      ));
  }

  async processGroupMessage(messageId: string) {
    const [groupMessage] = await db.select().from(groupMessages).where(eq(groupMessages.id, messageId));
    if (!groupMessage) return;

    // Parse audience
    const audience = JSON.parse(groupMessage.audience);
    let clientIds: string[] = [];

    if (audience.type === 'all') {
      const clients = await this.getClientsByCoach(groupMessage.coachId, { isActive: true });
      clientIds = clients.clients.map((c: any) => c.id);
    } else if (audience.type === 'clients') {
      clientIds = audience.ids || [];
    }

    // Create individual messages and recipients
    const now = new Date();
    for (const clientId of clientIds) {
      const messageId = randomUUID();
      
      // Insert into messages table (so it appears in threads)
      await db.insert(messages).values({
        id: messageId,
        coachId: groupMessage.coachId,
        clientId,
        senderId: groupMessage.coachId,
        body: groupMessage.body,
        groupMessageId: groupMessage.id,
        createdAt: now
      });

      // Insert into group_message_recipients for tracking
      await db.insert(groupMessageRecipients).values({
        id: randomUUID(),
        messageId: groupMessage.id,
        clientId,
        sentAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    // Mark as sent
    await db.update(groupMessages)
      .set({ status: 'sent', updatedAt: now })
      .where(eq(groupMessages.id, groupMessage.id));
  }
}

export const storage = new DatabaseStorage();
