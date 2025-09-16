function isMySqlEnv() {
  const raw = process.env.DATABASE_URL || '';
  return typeof raw === 'string' && raw.startsWith('mysql://');
}

export async function ensureMessagesTableRuntime() {
  if (isMySqlEnv()) {
    // Managed by migrations under MySQL
    return;
  }
  const { default: Database } = await import('better-sqlite3');
  const dbFile = process.env.SQLITE_PATH || process.env.DATABASE_URL || 'gymcoach.db';
  const filePath = dbFile.startsWith('file:') ? dbFile.replace(/^file:/, '') : dbFile;
  const sqlite = new Database(filePath);
  try {
    sqlite.pragma('foreign_keys = ON');

    const createSql = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        coach_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        FOREIGN KEY (coach_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
    `;

    // Helpful indexes for thread queries
    const idx1 = `CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(coach_id, client_id, created_at);`;
    const idx2 = `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);`;
    const idx3 = `CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_message_id);`;

    sqlite.exec(createSql);
    // Add group_message_id column if missing
    const cols = sqlite.prepare(`PRAGMA table_info(messages);`).all();
    const hasGroupCol = cols.some((c: any) => c.name === 'group_message_id');
    if (!hasGroupCol) {
      sqlite.exec(`ALTER TABLE messages ADD COLUMN group_message_id TEXT;`);
    }
    sqlite.exec(idx1);
    sqlite.exec(idx2);
    sqlite.exec(idx3);
  } catch (err) {
    console.error('ensure-messages-table-runtime error:', err);
  } finally {
    try { sqlite.close(); } catch {}
  }
}
