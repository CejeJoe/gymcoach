import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

// Create or connect to the SQLite database
const sqlite = new Database('gymcoach.db');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

// Create tables
async function initDB() {
  try {
    // Drop tables if they exist (for development)
    await db.run(sql`DROP TABLE IF EXISTS workouts`);
    await db.run(sql`DROP TABLE IF EXISTS clients`);
    await db.run(sql`DROP TABLE IF EXISTS users`);

    // Create users table
    await db.run(sql`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        avatar TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create clients table
    await db.run(sql`
      CREATE TABLE clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        goals TEXT,
        current_weight REAL,
        target_weight REAL,
        height REAL,
        start_date INTEGER NOT NULL,
        is_active INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coach_id) REFERENCES users(id)
      )
    `);

    // Create workouts table
    await db.run(sql`
      CREATE TABLE workouts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        exercises TEXT,
        scheduled_date INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (coach_id) REFERENCES users(id)
      )
    `);

    // Create messages table
    await db.run(sql`
      CREATE TABLE messages (
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
      )
    `);

    console.log('✅ Database tables created successfully!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  } finally {
    sqlite.close();
    process.exit(0);
  }
}

initDB();
