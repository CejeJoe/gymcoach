import Database from 'better-sqlite3';

// This script ensures the `messages` table exists without altering other tables.
// Safe to run multiple times.
(function main() {
  const dbFile = 'gymcoach.db';
  const sqlite = new Database(dbFile);
  try {
    // Ensure foreign keys are enforced
    sqlite.pragma('foreign_keys = ON');

    // Create messages table if it doesn't exist
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

    sqlite.exec(createSql);

    // Basic sanity check: PRAGMA table_info
    const rows = sqlite.prepare(`PRAGMA table_info(messages);`).all();
    if (!rows || rows.length === 0) {
      console.error('❌ Failed to verify messages table structure.');
      process.exit(1);
    }

    console.log('✅ ensure-messages-table: messages table is present.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ensure-messages-table error:', err);
    process.exit(1);
  } finally {
    try { sqlite.close(); } catch {}
  }
})();
