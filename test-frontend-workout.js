import fetch from 'node-fetch';

async function testFrontendWorkout() {
  console.log('🔍 Testing Frontend Workout Flow\n');

  try {
    // 1. Login as test client
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testclient@gymcoach.com',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('✅ Logged in as:', loginData.user.firstName, loginData.user.lastName);
    
    const token = loginData.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Start workout session
    console.log('\n2. Starting workout session...');
    const sessionResponse = await fetch('http://localhost:3001/api/workouts/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startTime: new Date().toISOString()
      })
    });

    const sessionData = await sessionResponse.json();
    console.log('✅ Session created:', sessionData.id);

    // 3. Add workout entries (simulating manual form input)
    console.log('\n3. Adding workout entries...');
    const entries = [
      {
        exercise: 'Push-ups',
        sets: 3,
        reps: 15,
        weight: null,
        duration: null,
        timestamp: new Date().toISOString(),
        rawText: 'Push-ups - 3 sets x 15 reps'
      },
      {
        exercise: 'Squats',
        sets: 3,
        reps: 20,
        weight: 50,
        duration: null,
        timestamp: new Date().toISOString(),
        rawText: 'Squats - 3 sets x 20 reps @ 50kg'
      },
      {
        exercise: 'Running',
        sets: null,
        reps: null,
        weight: null,
        duration: 30,
        timestamp: new Date().toISOString(),
        rawText: 'Running - 30 minutes'
      }
    ];

    const entriesResponse = await fetch('http://localhost:3001/api/workouts/entries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: sessionData.id,
        entries: entries
      })
    });

    if (entriesResponse.ok) {
      console.log('✅ Workout entries saved successfully');
    } else {
      const errorText = await entriesResponse.text();
      console.log('❌ Failed to save entries:', errorText);
    }

    // 4. Test client stats after workout
    console.log('\n4. Checking updated client stats...');
    const statsResponse = await fetch('http://localhost:3001/api/client/stats', {
      headers
    });

    const stats = await statsResponse.json();
    console.log('✅ Updated stats:', {
      totalWorkouts: stats.totalWorkouts,
      completedWorkouts: stats.completedWorkouts,
      progressEntries: stats.progressEntries
    });

    console.log('\n🎉 Frontend workout flow test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFrontendWorkout();
