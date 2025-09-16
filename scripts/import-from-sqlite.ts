import 'dotenv/config';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

/*
  Import data from a legacy SQLite database into current Postgres schema.

  Usage examples:
    - With env vars:
        SQLITE_PATH=./gymcoach.db npm run import:sqlite
    - With CLI arg:
        npm run import:sqlite -- --sqlite ./path/to/gymcoach.db

  Notes:
    - This script is idempotent-ish: it will upsert by id when possible.
    - It imports (in this order): users, clients, workouts, progress_entries, messages.
*/

const SQLITE_ARG_PREFIX = '--sqlite=';

function getSqlitePath(): string {
  const arg = process.argv.find(a => a.startsWith(SQLITE_ARG_PREFIX));
  if (arg) return arg.slice(SQLITE_ARG_PREFIX.length);
  const env = process.env.SQLITE_PATH;
  if (env) return env;
  // Common default from backup
  return './gymcoach.db';
}

function toUUID(id: any): string {
  if (typeof id === 'string' && id.length > 0) return id;
  return randomUUID();
}

async function main() {
  const sqlitePath = getSqlitePath();
  console.log(`[import] Using SQLite file: ${sqlitePath}`);

  const sqlite = new Database(sqlitePath, { readonly: true });

  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) throw new Error('DATABASE_URL must be set');
  const pgPool = new pg.Pool({ connectionString: pgUrl });
  const db = drizzlePg(pgPool, { schema });

  // Helpers
  const runSafe = <T>(fn: () => T, fallback: T): T => {
    try { return fn(); } catch { return fallback; }
  };
  const parseJSON = (val: any, fallback: any) => runSafe(() => {
    if (val == null) return fallback;
    if (typeof val === 'string') return JSON.parse(val);
    return val;
  }, fallback);

  const hasTable = (name: string): boolean => {
    try {
      const row = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
      return !!row;
    } catch {
      return false;
    }
  };

  // Maintain old->new userId mapping to remap FKs
  const userIdMap = new Map<string, string>();

  // 1) Users (upsert by email to avoid unique conflicts)
  console.log('[import] Importing users...');
  const usersRows = sqlite.prepare(`SELECT id, email, password, role, first_name as firstName, last_name as lastName, avatar, created_at as createdAt, updated_at as updatedAt FROM users`).all();
  for (const r of usersRows) {
    const oldId = String(r.id);
    const candidateId = toUUID(oldId);
    const rowBase = {
      email: r.email,
      password: r.password ?? '',
      role: r.role ?? 'client',
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      avatar: r.avatar ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    } as any;
    // Try find by email first (unique)
    const existingByEmail = await db.select().from(schema.users).where(eq(schema.users.email, rowBase.email));
    if (existingByEmail.length) {
      const existing = existingByEmail[0];
      await db.update(schema.users).set(rowBase).where(eq(schema.users.id, existing.id));
      userIdMap.set(oldId, existing.id as string);
    } else {
      const row = { id: candidateId, ...rowBase } as any;
      await db.insert(schema.users).values(row);
      userIdMap.set(oldId, candidateId);
    }
  }
  console.log(`[import] Users: ${usersRows.length}`);

  // 2) Clients
  console.log('[import] Importing clients...');
  const clientsRows = sqlite.prepare(`SELECT id, user_id as userId, coach_id as coachId, goals, current_weight as currentWeight, target_weight as targetWeight, height, start_date as startDate, is_active as isActive, created_at as createdAt, updated_at as updatedAt FROM clients`).all();
  for (const r of clientsRows) {
    const id = toUUID(r.id);
    const mappedUserId = userIdMap.get(String(r.userId)) || r.userId;
    const mappedCoachId = userIdMap.get(String(r.coachId)) || r.coachId;
    if (!userIdMap.has(String(r.userId))) {
      console.warn(`[import] WARN: client.userId mapping missing for ${r.userId}; using original`);
    }
    if (r.coachId && !userIdMap.has(String(r.coachId))) {
      console.warn(`[import] WARN: client.coachId mapping missing for ${r.coachId}; using original`);
    }
    const row = {
      id,
      userId: mappedUserId,
      coachId: mappedCoachId,
      goals: parseJSON(r.goals, null),
      currentWeight: r.currentWeight != null ? String(r.currentWeight) : null,
      targetWeight: r.targetWeight != null ? String(r.targetWeight) : null,
      height: r.height != null ? String(r.height) : null,
      startDate: r.startDate ? new Date(r.startDate) : new Date(),
      isActive: Boolean(r.isActive ?? true),
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    } as any;
    const existing = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
    if (existing.length) {
      await db.update(schema.clients).set(row).where(eq(schema.clients.id, id));
    } else {
      await db.insert(schema.clients).values(row);
    }
  }
  console.log(`[import] Clients: ${clientsRows.length}`);

  // 3) Workouts
  console.log('[import] Importing workouts...');
  const workoutsRows = sqlite.prepare(`SELECT id, client_id as clientId, coach_id as coachId, name, description, exercises, scheduled_date as scheduledDate, completed_at as completedAt, duration, notes, created_at as createdAt, updated_at as updatedAt FROM workouts`).all();
  for (const r of workoutsRows) {
    const id = toUUID(r.id);
    const mappedCoachId = userIdMap.get(String(r.coachId)) || r.coachId;
    if (r.coachId && !userIdMap.has(String(r.coachId))) {
      console.warn(`[import] WARN: workout.coachId mapping missing for ${r.coachId}; using original`);
    }
    const row = {
      id,
      clientId: r.clientId,
      coachId: mappedCoachId,
      name: r.name ?? 'Workout',
      description: r.description ?? null,
      exercises: parseJSON(r.exercises, []),
      scheduledDate: r.scheduledDate ? new Date(r.scheduledDate) : null,
      completedAt: r.completedAt ? new Date(r.completedAt) : null,
      duration: r.duration != null ? Number(r.duration) : null,
      notes: r.notes ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    } as any;
    const existing = await db.select().from(schema.workouts).where(eq(schema.workouts.id, id));
    if (existing.length) {
      await db.update(schema.workouts).set(row).where(eq(schema.workouts.id, id));
    } else {
      await db.insert(schema.workouts).values(row);
    }
  }
  console.log(`[import] Workouts: ${workoutsRows.length}`);

  // 4) Progress Entries
  if (hasTable('progress_entries')) {
    console.log('[import] Importing progress entries...');
    const progRows = sqlite.prepare(`SELECT id, client_id as clientId, weight, body_fat as bodyFat, muscle_mass as muscleMass, photos, measurements, notes, date, created_at as createdAt FROM progress_entries`).all();
    for (const r of progRows) {
      const id = toUUID(r.id);
      const row = {
        id,
        clientId: r.clientId,
        weight: r.weight != null ? String(r.weight) : null,
        bodyFat: r.bodyFat != null ? String(r.bodyFat) : null,
        muscleMass: r.muscleMass != null ? String(r.muscleMass) : null,
        photos: parseJSON(r.photos, null),
        measurements: parseJSON(r.measurements, null),
        notes: r.notes ?? null,
        date: r.date ? new Date(r.date) : new Date(),
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      } as any;
      const existing = await db.select().from(schema.progressEntries).where(eq(schema.progressEntries.id, id));
      if (existing.length) {
        await db.update(schema.progressEntries).set(row).where(eq(schema.progressEntries.id, id));
      } else {
        await db.insert(schema.progressEntries).values(row);
      }
    }
    console.log(`[import] Progress entries: ${progRows.length}`);
  } else {
    console.warn('[import] WARN: progress_entries table not found in SQLite; skipping.');
  }

  // 5) Messages (if present in SQLite)
  try {
    if (!hasTable('messages')) {
      console.warn('[import] WARN: messages table not found in SQLite; skipping.');
    } else {
      console.log('[import] Importing messages...');
      const msgRows = sqlite.prepare(`SELECT id, coach_id as coachId, client_id as clientId, sender_id as senderId, body, group_message_id as groupMessageId, created_at as createdAt, read_at as readAt FROM messages`).all();
    for (const r of msgRows) {
      const id = toUUID(r.id);
      const mappedCoachId = userIdMap.get(String(r.coachId)) || r.coachId;
      const mappedSenderId = userIdMap.get(String(r.senderId)) || r.senderId;
      if (r.coachId && !userIdMap.has(String(r.coachId))) console.warn(`[import] WARN: message.coachId mapping missing for ${r.coachId}; using original`);
      if (r.senderId && !userIdMap.has(String(r.senderId))) console.warn(`[import] WARN: message.senderId mapping missing for ${r.senderId}; using original`);
      const row = {
        id,
        coachId: mappedCoachId,
        clientId: r.clientId,
        senderId: mappedSenderId,
        body: r.body ?? '',
        groupMessageId: r.groupMessageId ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        readAt: r.readAt ? new Date(r.readAt) : null,
      } as any;
      const existing = await db.select().from(schema.messages).where(eq(schema.messages.id, id));
      if (existing.length) {
        await db.update(schema.messages).set(row).where(eq(schema.messages.id, id));
      } else {
        await db.insert(schema.messages).values(row);
      }
    }
    console.log(`[import] Messages: ${msgRows.length}`);
    }
  } catch (e) {
    console.warn('[import] WARN: messages import failed; skipping.', e);
  }

  console.log('[import] Done.');
  await pgPool.end();
}

main().catch((e) => {
  console.error('[import] Failed:', e);
  process.exit(1);
});
