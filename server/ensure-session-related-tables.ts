import { db } from './db';

function isMySqlEnv() {
  const raw = process.env.DATABASE_URL || '';
  return typeof raw === 'string' && raw.startsWith('mysql://');
}

export async function ensureSessionRelatedTables() {
  // This will create the tables if they don't exist
  // The table schemas are defined in sqlite-schema.ts
  console.log('Ensuring session-related tables exist...');
  
  if (isMySqlEnv()) {
    // Managed by migrations when using MySQL
    return;
  }

  const { default: Database } = await import('better-sqlite3');
  const dbFile = process.env.SQLITE_PATH || process.env.DATABASE_URL || 'gymcoach.db';
  const filePath = dbFile.startsWith('file:') ? dbFile.replace(/^file:/, '') : dbFile;
  const sqlite = new Database(filePath);
  try {
    sqlite.pragma('foreign_keys = ON');

    const createWorkoutSessions = `
      CREATE TABLE IF NOT EXISTS workout_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        coach_id TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coach_id) REFERENCES users(id)
      );
    `;

    const createWorkoutEntries = `
      CREATE TABLE IF NOT EXISTS workout_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT NOT NULL,
        coach_id TEXT,
        exercise TEXT NOT NULL,
        sets INTEGER,
        reps INTEGER,
        weight REAL,
        duration INTEGER,
        raw_text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (session_id) REFERENCES workout_sessions(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coach_id) REFERENCES users(id)
      );
    `;

    const createSessionLogs = `
      CREATE TABLE IF NOT EXISTS session_logs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        workout_id TEXT,
        performed TEXT,
        date INTEGER,
        duration INTEGER,
        average_rpe REAL,
        notes TEXT,
        created_at INTEGER,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (coach_id) REFERENCES users(id),
        FOREIGN KEY (workout_id) REFERENCES workouts(id)
      );
    `;

    const createBodyMeasurements = `
      CREATE TABLE IF NOT EXISTS body_measurements (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        date INTEGER,
        weight REAL,
        body_fat REAL,
        muscle_mass REAL,
        measurements TEXT,
        notes TEXT,
        created_at INTEGER,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `;

    sqlite.exec(createWorkoutSessions);
    sqlite.exec(createWorkoutEntries);
    sqlite.exec(createSessionLogs);
    sqlite.exec(createBodyMeasurements);
  } catch (err) {
    console.error('ensure-session-related-tables error:', err);
  } finally {
    try { sqlite.close(); } catch {}
  }
}
