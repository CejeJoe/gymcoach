import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'gymcoach.db'));

console.log('🗄️  GymCoach Database Viewer\n');

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📋 Available Tables:');
tables.forEach(table => console.log(`  - ${table.name}`));
console.log();

// Show users
console.log('👥 USERS:');
const users = db.prepare('SELECT * FROM users').all();
console.table(users);

// Show clients
console.log('\n👤 CLIENTS:');
const clients = db.prepare(`
  SELECT c.*, u.first_name, u.last_name, u.email 
  FROM clients c 
  JOIN users u ON c.user_id = u.id
`).all();
console.table(clients);

// Show workouts
console.log('\n💪 WORKOUTS:');
const workouts = db.prepare(`
  SELECT w.*, u.first_name as clientName
  FROM workouts w 
  JOIN clients c ON w.client_id = c.id
  JOIN users u ON c.user_id = u.id
  ORDER BY w.created_at DESC
`).all();
console.table(workouts.map(w => ({
  id: w.id.substring(0, 8) + '...',
  name: w.name,
  clientName: w.clientName,
  scheduledDate: w.scheduled_date ? new Date(w.scheduled_date).toLocaleDateString() : null,
  completedAt: w.completed_at ? new Date(w.completed_at).toLocaleDateString() : null,
  exercises: JSON.parse(w.exercises || '[]').length + ' exercises'
})));

// Show progress entries
console.log('\n📊 PROGRESS ENTRIES:');
try {
  const progress = db.prepare(`
    SELECT p.*, u.first_name as clientName
    FROM progress_entries p 
    JOIN clients c ON p.client_id = c.id
    JOIN users u ON c.user_id = u.id
    ORDER BY p.date DESC
  `).all();
  if (progress.length > 0) {
    console.table(progress);
  } else {
    console.log('  No progress entries found');
  }
} catch (error) {
  console.log('  Progress entries table does not exist yet');
}

// Show messages
console.log('\n💬 MESSAGES:');
try {
  const messages = db.prepare(`
    SELECT m.*, 
      sender.first_name as senderName,
      client_user.first_name as clientName
    FROM messages m 
    JOIN users sender ON m.sender_id = sender.id
    JOIN clients c ON m.client_id = c.id
    JOIN users client_user ON c.user_id = client_user.id
    ORDER BY m.created_at DESC
    LIMIT 10
  `).all();
  if (messages.length > 0) {
    console.table(messages.map(m => ({
      id: m.id.substring(0, 8) + '...',
      senderName: m.senderName,
      clientName: m.clientName,
      body: m.body.substring(0, 50) + (m.body.length > 50 ? '...' : ''),
      createdAt: new Date(m.created_at).toLocaleString()
    })));
  } else {
    console.log('  No messages found');
  }
} catch (error) {
  console.log('  Messages table does not exist yet');
}

// Show group messages
console.log('\n📣 GROUP MESSAGES:');
try {
  const groupMsgs = db.prepare(`
    SELECT * FROM group_messages ORDER BY created_at DESC LIMIT 10
  `).all();
  if (groupMsgs.length > 0) {
    console.table(groupMsgs.map(gm => ({
      id: gm.id.substring(0,8)+'...',
      coach: gm.coach_id.substring(0,8)+'...',
      title: gm.title,
      status: gm.status,
      scheduledAt: new Date(gm.scheduled_at).toLocaleString(),
      createdAt: new Date(gm.created_at).toLocaleString(),
    })));
  } else {
    console.log('  No group messages found');
  }
} catch (e) {
  console.log('  group_messages table does not exist yet');
}

// Show group message recipients
console.log('\n👥 GROUP MESSAGE RECIPIENTS (latest 10):');
try {
  const recips = db.prepare(`
    SELECT r.*, u.first_name as clientName
    FROM group_message_recipients r
    JOIN clients c ON r.client_id = c.id
    JOIN users u ON c.user_id = u.id
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all();
  if (recips.length > 0) {
    console.table(recips.map(r => ({
      id: r.id.substring(0,8)+'...',
      groupMsg: r.message_id.substring(0,8)+'...',
      client: r.clientName,
      sentAt: r.sent_at ? new Date(r.sent_at).toLocaleString() : null,
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toLocaleString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toLocaleString() : null,
    })));
  } else {
    console.log('  No group message recipients found');
  }
} catch (e) {
  console.log('  group_message_recipients table does not exist yet');
}

// Database stats
console.log('\n📈 DATABASE STATS:');
const stats = {
  'Total Users': db.prepare('SELECT COUNT(*) as count FROM users').get().count,
  'Total Clients': db.prepare('SELECT COUNT(*) as count FROM clients').get().count,
  'Total Workouts': db.prepare('SELECT COUNT(*) as count FROM workouts').get().count,
  'Completed Workouts': db.prepare('SELECT COUNT(*) as count FROM workouts WHERE completed_at IS NOT NULL').get().count,
};
console.table(stats);

db.close();
