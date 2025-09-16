function isMySqlEnv() {
  const raw = process.env.DATABASE_URL || '';
  return typeof raw === 'string' && raw.startsWith('mysql://');
}

export async function ensureGroupMessagesTables() {
  if (isMySqlEnv()) {
    return; // Managed by migrations in MySQL
  }
  const { default: Database } = await import('better-sqlite3');
  const dbFile = process.env.SQLITE_PATH || process.env.DATABASE_URL || 'gymcoach.db';
  const filePath = dbFile.startsWith('file:') ? dbFile.replace(/^file:/, '') : dbFile;
  const sqlite = new Database(filePath);
  try {
    sqlite.pragma('foreign_keys = ON');

    const createGroupMessages = `
      CREATE TABLE IF NOT EXISTS group_messages (
        id TEXT PRIMARY KEY,
        coach_id TEXT NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        scheduled_at INTEGER NOT NULL,
        require_confirmation INTEGER DEFAULT 0,
        audience TEXT NOT NULL,
        workout_id TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (coach_id) REFERENCES users(id),
        FOREIGN KEY (workout_id) REFERENCES workouts(id)
      );
    `;

    const createGroupMessageRecipients = `
      CREATE TABLE IF NOT EXISTS group_message_recipients (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        sent_at INTEGER,
        confirmed_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (message_id) REFERENCES group_messages(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `;

    const idx1 = `CREATE INDEX IF NOT EXISTS idx_group_messages_coach ON group_messages(coach_id);`;
    const idx2 = `CREATE INDEX IF NOT EXISTS idx_group_messages_status ON group_messages(status);`;
    const idx3 = `CREATE INDEX IF NOT EXISTS idx_group_messages_scheduled ON group_messages(scheduled_at);`;
    const idx4 = `CREATE INDEX IF NOT EXISTS idx_gmr_message ON group_message_recipients(message_id);`;
    const idx5 = `CREATE INDEX IF NOT EXISTS idx_gmr_client ON group_message_recipients(client_id);`;

    sqlite.exec(createGroupMessages);
    sqlite.exec(createGroupMessageRecipients);
    sqlite.exec(idx1);
    sqlite.exec(idx2);
    sqlite.exec(idx3);
    sqlite.exec(idx4);
    sqlite.exec(idx5);
  } catch (err) {
    console.error('ensure-group-messages-tables error:', err);
  } finally {
    try { sqlite.close(); } catch {}
  }
}
