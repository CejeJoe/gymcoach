// Create sample data for the coach
import { storage } from './server/storage.js';
import bcrypt from 'bcrypt';

async function createSampleData() {
  try {
    console.log('Creating sample data for coach...\n');

    const coachId = '047d94d8-c9ff-436a-b383-e9d79658e2de';
    
    // Create sample client users
    const clientUsers = [];
    
    for (let i = 1; i <= 3; i++) {
      try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const clientUser = await storage.createUser({
          email: `client${i}@example.com`,
          password: hashedPassword,
          firstName: `Client${i}`,
          lastName: `User`,
          role: 'client'
        });
        clientUsers.push(clientUser);
        console.log(`✓ Created client user: ${clientUser.email}`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`- Client ${i} already exists, fetching...`);
          const existingUser = await storage.getUserByEmail(`client${i}@example.com`);
          if (existingUser) clientUsers.push(existingUser);
        } else {
          throw error;
        }
      }
    }

    // Create client profiles for the coach
    for (const clientUser of clientUsers) {
      try {
        const client = await storage.createClient({
          userId: clientUser.id,
          coachId: coachId,
          goals: `Get fit and healthy - Client ${clientUser.firstName}`,
          fitnessLevel: 'beginner',
          medicalConditions: 'None',
          isActive: true,
          currentWeight: 70 + Math.random() * 30,
          targetWeight: 65 + Math.random() * 25,
          height: 160 + Math.random() * 25
        });
        console.log(`✓ Created client profile for: ${clientUser.firstName}`);

        // Create some workouts for this client
        for (let w = 1; w <= 3; w++) {
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + (w - 2)); // Yesterday, today, tomorrow

          const workout = await storage.createWorkout({
            name: `Workout ${w} for ${clientUser.firstName}`,
            description: `Training session ${w}`,
            clientId: client.id,
            coachId: coachId,
            scheduledDate: scheduledDate,
            exercises: [
              { name: 'Push-ups', sets: 3, reps: 15, weight: null },
              { name: 'Squats', sets: 3, reps: 20, weight: null }
            ]
          });

          // Complete some workouts
          if (w === 1) {
            await storage.completeWorkout(workout.id, 45, 'Great session!');
          }
        }
        console.log(`✓ Created workouts for: ${clientUser.firstName}`);

        // Create progress entries
        const progressDate1 = new Date();
        progressDate1.setDate(progressDate1.getDate() - 7);
        
        await storage.createProgressEntry({
          clientId: client.id,
          date: progressDate1,
          weight: client.currentWeight + 2,
          bodyFat: 20,
          muscleMass: 30,
          notes: 'Starting measurements'
        });

        await storage.createProgressEntry({
          clientId: client.id,
          date: new Date(),
          weight: client.currentWeight,
          bodyFat: 18,
          muscleMass: 32,
          notes: 'Progress update'
        });
        console.log(`✓ Created progress entries for: ${clientUser.firstName}`);

      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`- Client profile already exists for: ${clientUser.firstName}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Sample data creation completed!');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

createSampleData();
