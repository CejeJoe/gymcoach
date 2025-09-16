import { db } from './db';
import { sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// Define types based on the SQLite schema
type User = {
  id: string;
  email: string;
  password: string;
  role: 'coach' | 'client';
  firstName: string;
  lastName: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
};

type Client = {
  id: string;
  userId: string;
  coachId: string;
  goals?: Record<string, any>;
  currentWeight?: number;
  targetWeight?: number;
  height?: number;
  startDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function seedDemoUsers() {
  try {
    // Delete existing data in the correct order to respect foreign key constraints
    await db.run(sql`DELETE FROM workouts`);
    await db.run(sql`DELETE FROM clients`);
    await db.run(sql`DELETE FROM users`);
    console.log('✅ Cleared existing data');

    // Hash passwords
    const coachPassword = await hashPassword('coach123');
    const clientPassword = await hashPassword('client123');
    const now = new Date();
    
    // Insert coach user
    const coachId = randomUUID();
    const coachData = {
      id: coachId,
      email: 'coach@thrst.com',
      password: coachPassword,
      role: 'coach' as const,
      firstName: 'Demo',
      lastName: 'Coach',
      avatar: 'https://i.pravatar.cc/150?img=1',
      createdAt: now,
      updatedAt: now
    };

    // Insert coach user
    await db.run(sql`
      INSERT INTO users (id, email, password, role, first_name, last_name, avatar, created_at, updated_at)
      VALUES (${coachData.id}, ${coachData.email}, ${coachData.password}, ${coachData.role}, 
              ${coachData.firstName}, ${coachData.lastName}, ${coachData.avatar || null}, 
              ${Math.floor(coachData.createdAt.getTime() / 1000)}, ${Math.floor(coachData.updatedAt.getTime() / 1000)})
    `);
    console.log('✅ Created coach user');

    // Insert client user
    const clientId = randomUUID();
    const clientData = {
      id: clientId,
      email: 'client@thrst.com',
      password: clientPassword,
      role: 'client' as const,
      firstName: 'Demo',
      lastName: 'Client',
      avatar: 'https://i.pravatar.cc/150?img=2',
      createdAt: now,
      updatedAt: now
    };

    await db.run(sql`
      INSERT INTO users (id, email, password, role, first_name, last_name, avatar, created_at, updated_at)
      VALUES (${clientData.id}, ${clientData.email}, ${clientData.password}, ${clientData.role}, 
              ${clientData.firstName}, ${clientData.lastName}, ${clientData.avatar || null}, 
              ${Math.floor(clientData.createdAt.getTime() / 1000)}, ${Math.floor(clientData.updatedAt.getTime() / 1000)})
    `);
    console.log('✅ Created client user');

    // Create client-coach relationship
    const clientRecordId = randomUUID();
    const goals = JSON.stringify({ goal1: 'Lose 5kg', goal2: 'Improve endurance' });
    await db.run(sql`
      INSERT INTO clients (id, user_id, coach_id, goals, current_weight, target_weight, height, start_date, is_active, created_at, updated_at)
      VALUES (
        ${clientRecordId}, 
        ${clientId}, 
        ${coachId}, 
        ${goals}, 
        75.5, 
        70.0, 
        175, 
        ${Math.floor(now.getTime() / 1000)}, 
        1, 
        ${Math.floor(now.getTime() / 1000)}, 
        ${Math.floor(now.getTime() / 1000)}
      )
    `);
    console.log('✅ Created client-coach relationship');

    console.log('✅ Demo users created successfully!');
    console.log('Coach:', { email: 'coach@thrst.com', password: 'coach123' });
    console.log('Client:', { email: 'client@thrst.com', password: 'client123' });
  } catch (error) {
    console.error('❌ Error seeding demo users:', error);
  } finally {
    process.exit(0);
  }
}

seedDemoUsers();
