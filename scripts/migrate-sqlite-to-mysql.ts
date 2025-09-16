import 'dotenv/config';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const MYSQL_HOST = process.env.MYSQL_HOST;
  const MYSQL_USER = process.env.MYSQL_USER;
  const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
  const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
  const MYSQL_PORT = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : undefined;
  const usingDiscrete = Boolean(MYSQL_HOST && MYSQL_USER && (MYSQL_PASSWORD !== undefined) && MYSQL_DATABASE);
  if (!usingDiscrete && (!DATABASE_URL || !DATABASE_URL.startsWith('mysql://'))) {
    console.error('ERROR: Provide either a mysql:// DATABASE_URL or discrete MYSQL_* env vars.');
    process.exit(1);
  }

  const sqlitePath = (process.env.SQLITE_PATH && process.env.SQLITE_PATH !== '')
    ? (process.env.SQLITE_PATH.startsWith('file:') ? process.env.SQLITE_PATH.replace(/^file:/, '') : process.env.SQLITE_PATH)
    : 'gymcoach.db';

  console.log('Starting migration from SQLite to MySQL');
  console.log(' - SQLite file:', sqlitePath);
  console.log(' - MySQL:', usingDiscrete ? `${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT ?? 3306}/${MYSQL_DATABASE}` : DATABASE_URL!.replace(/:[^:@/]+@/, ':****@'));

  // Create SQLite drizzle client
  const { default: SqliteDatabase } = await import('better-sqlite3');
  const { drizzle: sqliteDrizzle } = await import('drizzle-orm/better-sqlite3');
  const sqliteSchema: any = await import('../shared/sqlite-schema');
  const sqlite = new SqliteDatabase(sqlitePath);
  sqlite.pragma('foreign_keys = ON');
  const sdb = sqliteDrizzle(sqlite, { schema: sqliteSchema });

  // Create MySQL drizzle client
  const { drizzle: mysqlDrizzle } = await import('drizzle-orm/mysql2');
  const mysql = await import('mysql2/promise');
  const mysqlSchema: any = await import('../shared/mysql-schema');
  const pool = usingDiscrete
    ? mysql.createPool({ host: MYSQL_HOST, user: MYSQL_USER, password: MYSQL_PASSWORD, database: MYSQL_DATABASE, port: MYSQL_PORT, waitForConnections: true, connectionLimit: 10 })
    : mysql.createPool(DATABASE_URL as any);
  const mdb = mysqlDrizzle(pool, { schema: mysqlSchema });

  // Helper counters
  const counts: Record<string, number> = {};

  // Ensure MySQL DB is empty (optional safety)
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM `users`');
    const cnt = Array.isArray(rows) && rows.length ? (rows as any)[0].cnt : 0;
    if (cnt > 0) {
      console.error('Target MySQL database is not empty. Aborting to avoid duplicates.');
      process.exit(1);
    }
  } catch (e) {
    // If table does not exist yet, that's fine; migrations will create it
  }

  // Utility to coerce timestamps to Date
  const toDate = (v: any): Date | null => {
    if (v == null) return null;
    if (v instanceof Date) return v;
    const n = Number(v);
    if (!Number.isNaN(n)) return new Date(n);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // USERS
  const sqliteUsers = await sdb.select().from(sqliteSchema.users);
  if (sqliteUsers.length) {
    await mdb.insert(mysqlSchema.users).values(sqliteUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      password: u.password,
      role: u.role,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar ?? null,
      createdAt: toDate(u.createdAt) ?? new Date(),
      updatedAt: toDate(u.updatedAt) ?? new Date(),
    })));
  }
  counts.users = sqliteUsers.length;
  console.log(`Migrated users: ${counts.users}`);

  // CLIENTS
  const sqliteClients = await sdb.select().from(sqliteSchema.clients);
  if (sqliteClients.length) {
    await mdb.insert(mysqlSchema.clients).values(sqliteClients.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      coachId: c.coachId,
      goals: c.goals ?? null,
      currentWeight: c.currentWeight ?? null,
      targetWeight: c.targetWeight ?? null,
      height: c.height ?? null,
      startDate: toDate(c.startDate),
      isActive: Boolean(c.isActive),
      createdAt: toDate(c.createdAt) ?? new Date(),
      updatedAt: toDate(c.updatedAt) ?? new Date(),
    })));
  }
  counts.clients = sqliteClients.length;
  console.log(`Migrated clients: ${counts.clients}`);

  // WORKOUTS
  const sqliteWorkouts = await sdb.select().from(sqliteSchema.workouts);
  if (sqliteWorkouts.length) {
    await mdb.insert(mysqlSchema.workouts).values(sqliteWorkouts.map((w: any) => ({
      id: w.id,
      clientId: w.clientId,
      coachId: w.coachId,
      name: w.name,
      description: w.description ?? null,
      exercises: Array.isArray(w.exercises) ? w.exercises : (typeof w.exercises === 'string' ? (()=>{ try{return JSON.parse(w.exercises)}catch{return []}})() : []),
      scheduledDate: toDate(w.scheduledDate),
      completedAt: toDate(w.completedAt),
      duration: w.duration ?? null,
      notes: w.notes ?? null,
      createdAt: toDate(w.createdAt) ?? new Date(),
      updatedAt: toDate(w.updatedAt) ?? new Date(),
    })));
  }
  counts.workouts = sqliteWorkouts.length;
  console.log(`Migrated workouts: ${counts.workouts}`);

  // PROGRESS ENTRIES
  const sqliteProgress = await sdb.select().from(sqliteSchema.progressEntries);
  if (sqliteProgress.length) {
    await mdb.insert(mysqlSchema.progressEntries).values(sqliteProgress.map((p: any) => ({
      id: p.id,
      clientId: p.clientId,
      weight: p.weight ?? null,
      bodyFat: p.bodyFat ?? null,
      muscleMass: p.muscleMass ?? null,
      photos: Array.isArray(p.photos) ? p.photos : (typeof p.photos === 'string' ? (()=>{ try{return JSON.parse(p.photos)}catch{return []}})() : []),
      measurements: p.measurements && typeof p.measurements === 'object' ? p.measurements : (typeof p.measurements === 'string' ? (()=>{ try{return JSON.parse(p.measurements)}catch{return {}}})() : {}),
      notes: p.notes ?? null,
      date: toDate(p.date) ?? new Date(),
      createdAt: toDate(p.createdAt) ?? new Date(),
    })));
  }
  counts.progress = sqliteProgress.length;
  console.log(`Migrated progress entries: ${counts.progress}`);

  // MESSAGES
  const sqliteMessages = await sdb.select().from(sqliteSchema.messages);
  if (sqliteMessages.length) {
    await mdb.insert(mysqlSchema.messages).values(sqliteMessages.map((m: any) => ({
      id: m.id,
      coachId: m.coachId,
      clientId: m.clientId,
      senderId: m.senderId,
      body: m.body,
      groupMessageId: (m as any).groupMessageId ?? null,
      createdAt: toDate(m.createdAt) ?? new Date(),
      readAt: toDate(m.readAt),
    })));
  }
  counts.messages = sqliteMessages.length;
  console.log(`Migrated messages: ${counts.messages}`);

  // GROUP MESSAGES
  const sqliteGM = await sdb.select().from(sqliteSchema.groupMessages);
  if (sqliteGM.length) {
    await mdb.insert(mysqlSchema.groupMessages).values(sqliteGM.map((g: any) => ({
      id: g.id,
      coachId: g.coachId,
      title: g.title ?? null,
      body: g.body,
      scheduledAt: toDate(g.scheduledAt) ?? new Date(),
      requireConfirmation: Boolean(g.requireConfirmation),
      audience: typeof g.audience === 'string' ? g.audience : JSON.stringify(g.audience ?? {}),
      workoutId: g.workoutId ?? null,
      status: g.status ?? 'scheduled',
      createdAt: toDate(g.createdAt) ?? new Date(),
      updatedAt: toDate(g.updatedAt) ?? new Date(),
    })));
  }
  counts.groupMessages = sqliteGM.length;
  console.log(`Migrated group_messages: ${counts.groupMessages}`);

  // GROUP MESSAGE RECIPIENTS
  const sqliteGMR = await sdb.select().from(sqliteSchema.groupMessageRecipients);
  if (sqliteGMR.length) {
    await mdb.insert(mysqlSchema.groupMessageRecipients).values(sqliteGMR.map((r: any) => ({
      id: r.id,
      messageId: r.messageId,
      clientId: r.clientId,
      sentAt: toDate(r.sentAt),
      confirmedAt: toDate(r.confirmedAt),
      createdAt: toDate(r.createdAt) ?? new Date(),
      updatedAt: toDate(r.updatedAt) ?? new Date(),
    })));
  }
  counts.groupMessageRecipients = sqliteGMR.length;
  console.log(`Migrated group_message_recipients: ${counts.groupMessageRecipients}`);

  // SESSION LOGS
  const sqliteSessionLogs = await sdb.select().from(sqliteSchema.sessionLogs);
  if (sqliteSessionLogs.length) {
    await mdb.insert(mysqlSchema.sessionLogs).values(sqliteSessionLogs.map((sl: any) => ({
      id: sl.id,
      clientId: sl.clientId,
      coachId: sl.coachId,
      workoutId: sl.workoutId ?? null,
      performed: Array.isArray(sl.performed) ? sl.performed : (typeof sl.performed === 'string' ? (()=>{ try{return JSON.parse(sl.performed)}catch{return []}})() : []),
      date: toDate(sl.date) ?? new Date(),
      duration: sl.duration ?? null,
      averageRpe: sl.averageRpe ?? null,
      notes: sl.notes ?? null,
      createdAt: toDate(sl.createdAt) ?? new Date(),
    })));
  }
  counts.sessionLogs = sqliteSessionLogs.length;
  console.log(`Migrated session_logs: ${counts.sessionLogs}`);

  // BODY MEASUREMENTS
  const sqliteBM = await sdb.select().from(sqliteSchema.bodyMeasurements);
  if (sqliteBM.length) {
    await mdb.insert(mysqlSchema.bodyMeasurements).values(sqliteBM.map((bm: any) => ({
      id: bm.id,
      clientId: bm.clientId,
      date: toDate(bm.date) ?? new Date(),
      weight: bm.weight ?? null,
      bodyFat: bm.bodyFat ?? null,
      muscleMass: bm.muscleMass ?? null,
      measurements: bm.measurements && typeof bm.measurements === 'object' ? bm.measurements : (typeof bm.measurements === 'string' ? (()=>{ try{return JSON.parse(bm.measurements)}catch{return {}}})() : {}),
      notes: bm.notes ?? null,
      createdAt: toDate(bm.createdAt) ?? new Date(),
    })));
  }
  counts.bodyMeasurements = sqliteBM.length;
  console.log(`Migrated body_measurements: ${counts.bodyMeasurements}`);

  // WORKOUT SESSIONS
  const sqliteWS = await sdb.select().from(sqliteSchema.workoutSessions);
  if (sqliteWS.length) {
    await mdb.insert(mysqlSchema.workoutSessions).values(sqliteWS.map((ws: any) => ({
      id: ws.id,
      userId: ws.userId,
      coachId: ws.coachId ?? null,
      startTime: toDate(ws.startTime) ?? new Date(),
      endTime: toDate(ws.endTime),
      isActive: Boolean(ws.isActive),
      createdAt: toDate(ws.createdAt) ?? new Date(),
      updatedAt: toDate(ws.updatedAt) ?? new Date(),
    })));
  }
  counts.workoutSessions = sqliteWS.length;
  console.log(`Migrated workout_sessions: ${counts.workoutSessions}`);

  // WORKOUT ENTRIES
  const sqliteWE = await sdb.select().from(sqliteSchema.workoutEntries);
  if (sqliteWE.length) {
    await mdb.insert(mysqlSchema.workoutEntries).values(sqliteWE.map((we: any) => ({
      id: we.id,
      sessionId: we.sessionId ?? null,
      userId: we.userId,
      coachId: we.coachId ?? null,
      exercise: we.exercise,
      sets: we.sets ?? null,
      reps: we.reps ?? null,
      weight: we.weight ?? null,
      duration: we.duration ?? null,
      rawText: we.rawText ?? '',
      timestamp: toDate(we.timestamp) ?? new Date(),
      createdAt: toDate(we.createdAt) ?? new Date(),
      updatedAt: toDate(we.updatedAt) ?? new Date(),
    })));
  }
  counts.workoutEntries = sqliteWE.length;
  console.log(`Migrated workout_entries: ${counts.workoutEntries}`);

  await pool.end();
  sqlite.close();
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
