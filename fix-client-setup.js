import { storage } from './server/storage.ts';
import bcrypt from 'bcrypt';

async function fixClientSetup() {
  console.log('🔧 Setting up client profile for test user...\n');

  try {
    // Get the test client user
    const testUser = await storage.getUserByEmail('testclient@gymcoach.com');
    if (!testUser) {
      console.log('❌ Test client user not found');
      return;
    }

    console.log('✅ Found test user:', testUser.firstName, testUser.lastName);

    // Check if client profile already exists
    const existingClient = await storage.getClientByUserId(testUser.id);
    if (existingClient) {
      console.log('✅ Client profile already exists:', existingClient.id);
      return;
    }

    // Get a coach user (Demo Coach has ID from database)
    const demoCoach = await storage.getUser('047d94d8-c9ff-436a-b383-e9d79658e2de');
    if (!demoCoach) {
      console.log('❌ Demo coach not found');
      return;
    }

    console.log('✅ Found coach:', demoCoach.firstName, demoCoach.lastName);

    // Create client profile
    const clientProfile = await storage.createClient({
      userId: testUser.id,
      coachId: demoCoach.id,
      goals: { primary: 'Weight loss', secondary: 'Strength building' },
      currentWeight: 70,
      targetWeight: 65,
      height: 170,
      isActive: true
    });

    console.log('✅ Created client profile:', clientProfile.id);
    console.log('✅ Test client setup complete!');

  } catch (error) {
    console.error('❌ Error setting up client:', error.message);
  }
}

fixClientSetup();
