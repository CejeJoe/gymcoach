// Create test data for the GymCoach application
import { storage } from './server/storage.js';

async function createTestData() {
  try {
    console.log('Creating test data...\n');

    // Create a test client user
    const clientUser = await storage.createUser({
      email: 'client@example.com',
      password: '$2b$10$example.hash.for.password123', // bcrypt hash for 'password123'
      firstName: 'John',
      lastName: 'Doe',
      role: 'client'
    });
    console.log('✓ Created test client user:', clientUser.email);

    // Create a client profile for the coach
    const coachUser = await storage.getUserByEmail('coach@example.com');
    if (coachUser) {
      const client = await storage.createClient({
        userId: clientUser.id,
        coachId: coachUser.id,
        goals: 'Lose weight and build muscle',
        fitnessLevel: 'beginner',
        medicalConditions: 'None',
        isActive: true
      });
      console.log('✓ Created client profile for coach');

      // Create some test workouts
      const workout1 = await storage.createWorkout({
        name: 'Morning Cardio Session',
        description: '30-minute cardio workout to start the day',
        clientId: client.id,
        coachId: coachUser.id,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        exercises: [
          { name: 'Running', duration: 20, sets: 1, reps: null },
          { name: 'Jumping Jacks', duration: 5, sets: 3, reps: 20 },
          { name: 'Cool Down Stretch', duration: 5, sets: 1, reps: null }
        ]
      });
      console.log('✓ Created test workout 1');

      const workout2 = await storage.createWorkout({
        name: 'Strength Training',
        description: 'Upper body strength workout',
        clientId: client.id,
        coachId: coachUser.id,
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        exercises: [
          { name: 'Push-ups', duration: null, sets: 3, reps: 15 },
          { name: 'Pull-ups', duration: null, sets: 3, reps: 8 },
          { name: 'Bench Press', duration: null, sets: 3, reps: 12 }
        ]
      });
      console.log('✓ Created test workout 2');

      // Complete the second workout
      await storage.completeWorkout(workout2.id, 45, 'Great session, client showed improvement');
      console.log('✓ Marked workout 2 as completed');

      // Create some progress entries
      await storage.createProgressEntry({
        clientId: client.id,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        weight: 180.5,
        bodyFat: 18.2,
        muscleMass: 65.3,
        notes: 'Starting measurements'
      });

      await storage.createProgressEntry({
        clientId: client.id,
        date: new Date(), // Today
        weight: 178.2,
        bodyFat: 17.8,
        muscleMass: 65.8,
        notes: 'Good progress this week'
      });
      console.log('✓ Created progress entries');

      // Create some messages
      await storage.createMessage({
        senderId: coachUser.id,
        receiverId: clientUser.id,
        content: 'Great job on your workout yesterday! Keep up the good work.',
        messageType: 'text'
      });

      await storage.createMessage({
        senderId: clientUser.id,
        receiverId: coachUser.id,
        content: 'Thank you! I feel stronger already. When is my next session?',
        messageType: 'text'
      });
      console.log('✓ Created test messages');

      console.log('\n✅ All test data created successfully!');
    }

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();
