import 'dotenv/config';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { and, eq, sql } from 'drizzle-orm';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // Pick a default coach: prefer coach@thrst.com, otherwise first user with role coach
  const [preferredCoach] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'coach@thrst.com'));

  const [fallbackCoach] = preferredCoach
    ? [preferredCoach]
    : await db.select().from(schema.users).where(eq(schema.users.role as any, 'coach')).limit(1);

  if (!fallbackCoach) {
    console.warn('[backfill] No coach users found. Cannot assign coachId. Aborting.');
    await pool.end();
    return;
  }

  const coachId = (fallbackCoach as any).id as string;
  console.log('[backfill] Using coachId:', coachId, 'email:', (fallbackCoach as any).email);

  // Find client-role users without a client profile
  const clientUsers = await db.select().from(schema.users).where(eq(schema.users.role as any, 'client'));

  let created = 0;
  for (const u of clientUsers as any[]) {
    const existing = await db.select().from(schema.clients).where(eq(schema.clients.userId, u.id));
    if (existing.length > 0) continue;

    const id = randomUUID();
    await db.insert(schema.clients).values({
      id,
      userId: u.id,
      coachId,
      goals: null,
      currentWeight: null,
      targetWeight: null,
      height: null,
      startDate: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    created++;
    console.log('[backfill] Created client profile for', u.email, '->', id);
  }

  console.log(`[backfill] Done. Created ${created} client profiles.`);
  await pool.end();
}

main().catch((e) => {
  console.error('[backfill] Failed:', e);
  process.exit(1);
});
