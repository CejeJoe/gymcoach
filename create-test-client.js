import { storage } from './server/storage.ts';
import bcrypt from 'bcrypt';

async function createTestClient() {
  console.log('🔧 Creating test client user...\n');

  try {
    // Create a test client user with proper password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const testUser = await storage.createUser({
      email: 'testclient@gymcoach.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Client',
      role: 'client'
    });

    console.log('✅ Created user:', testUser.firstName, testUser.lastName);

    // Get the first coach from users table
    const allUsers = await storage.getAllUsers();
    const coaches = allUsers.filter(u => u.role === 'coach');
    if (coaches.length === 0) {
      console.log('❌ No coaches found in database');
      return;
    }
    const coach = coaches[0];
    console.log('✅ Found coach:', coach.firstName, coach.lastName);

    // Create client profile
    const clientProfile = await storage.createClient({
      userId: testUser.id,
      coachId: coach.id,
      goals: { primary: 'Weight loss', secondary: 'Strength building' },
      currentWeight: 70,
      targetWeight: 65,
      height: 170,
      isActive: true
    });

    console.log('✅ Created client profile:', clientProfile.id);
    console.log('✅ Test client ready!');
    console.log('   Email: testclient@gymcoach.com');
    console.log('   Password: password123');
    console.log('   Role: client');

  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log('✅ Test client already exists');
    } else {
      console.error('❌ Error creating test client:', error.message);
    }
  }
}

createTestClient();
