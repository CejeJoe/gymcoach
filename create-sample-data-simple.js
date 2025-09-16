// Create sample data using API calls
const BASE_URL = 'http://localhost:3001';

async function createSampleData() {
  try {
    console.log('Creating sample data for coach...\n');

    // Login first
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'coach@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('✅ Authentication successful');

    // Create sample clients
    const clientsToCreate = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        goals: 'Lose weight and build muscle',
        currentWeight: 85,
        targetWeight: 75,
        height: 180
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        goals: 'Improve cardiovascular health',
        currentWeight: 65,
        targetWeight: 60,
        height: 165
      },
      {
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@example.com',
        goals: 'Build strength and endurance',
        currentWeight: 90,
        targetWeight: 85,
        height: 175
      }
    ];

    const createdClients = [];

    for (const clientData of clientsToCreate) {
      try {
        const response = await fetch(`${BASE_URL}/api/coach/clients`, {
          method: 'POST',
          headers,
          body: JSON.stringify(clientData)
        });

        if (response.ok) {
          const result = await response.json();
          createdClients.push(result);
          console.log(`✓ Created client: ${clientData.firstName} ${clientData.lastName}`);
        } else {
          const error = await response.text();
          console.log(`- Client ${clientData.firstName} creation failed: ${error}`);
        }
      } catch (error) {
        console.log(`- Error creating client ${clientData.firstName}:`, error.message);
      }
    }

    // Create sample workouts for each client
    for (const client of createdClients) {
      if (!client.client?.id) continue;

      const workoutsToCreate = [
        {
          name: `Morning Cardio - ${client.client.user?.firstName}`,
          description: '30-minute cardio session',
          clientId: client.client.id,
          scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
          exercises: [
            { name: 'Running', sets: 1, reps: null, duration: 20 },
            { name: 'Cycling', sets: 1, reps: null, duration: 10 }
          ]
        },
        {
          name: `Strength Training - ${client.client.user?.firstName}`,
          description: 'Upper body workout',
          clientId: client.client.id,
          scheduledDate: new Date().toISOString(), // Today
          exercises: [
            { name: 'Push-ups', sets: 3, reps: 15 },
            { name: 'Pull-ups', sets: 3, reps: 8 }
          ]
        },
        {
          name: `HIIT Session - ${client.client.user?.firstName}`,
          description: 'High intensity interval training',
          clientId: client.client.id,
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          exercises: [
            { name: 'Burpees', sets: 3, reps: 10 },
            { name: 'Mountain Climbers', sets: 3, reps: 20 }
          ]
        }
      ];

      for (const workoutData of workoutsToCreate) {
        try {
          const response = await fetch(`${BASE_URL}/api/coach/workouts`, {
            method: 'POST',
            headers,
            body: JSON.stringify(workoutData)
          });

          if (response.ok) {
            const workout = await response.json();
            console.log(`✓ Created workout: ${workoutData.name}`);

            // Complete the first workout (yesterday's)
            if (workoutData.scheduledDate < new Date().toISOString()) {
              try {
                const completeResponse = await fetch(`${BASE_URL}/api/coach/workouts/${workout.id}/complete`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ duration: 45, notes: 'Great session!' })
                });
                if (completeResponse.ok) {
                  console.log(`✓ Completed workout: ${workoutData.name}`);
                }
              } catch (error) {
                console.log(`- Could not complete workout: ${error.message}`);
              }
            }
          } else {
            const error = await response.text();
            console.log(`- Workout creation failed: ${error}`);
          }
        } catch (error) {
          console.log(`- Error creating workout:`, error.message);
        }
      }
    }

    console.log('\n✅ Sample data creation completed!');
    console.log('Now testing the endpoints again...\n');

    // Test the endpoints again
    const statsResponse = await fetch(`${BASE_URL}/api/coach/stats`, { headers });
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('📊 Updated Stats:', JSON.stringify(stats, null, 2));
    }

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

createSampleData();
