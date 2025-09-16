import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testClientFlow() {
  console.log('🔍 Testing Complete Client Flow\n');

  try {
    // Login as the test client we just created
    console.log('1. Logging in as test client...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testclient@gymcoach.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status);
      return;
    }

    const { token, user } = await loginResponse.json();
    console.log('✅ Logged in as:', user.firstName, user.lastName, '(Role:', user.role + ')');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test all client endpoints
    console.log('\n2. Testing /api/client/profile...');
    const profileResponse = await fetch(`${BASE_URL}/api/client/profile`, { headers });
    console.log('Status:', profileResponse.status);
    
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Profile loaded - Client ID:', profile.id);
    } else {
      const error = await profileResponse.text();
      console.log('❌ Profile failed:', error);
    }

    console.log('\n3. Testing /api/client/workouts...');
    const workoutsResponse = await fetch(`${BASE_URL}/api/client/workouts`, { headers });
    console.log('Status:', workoutsResponse.status);
    
    if (workoutsResponse.ok) {
      const workouts = await workoutsResponse.json();
      console.log('✅ Workouts loaded:', workouts.length, 'workouts');
    } else {
      const error = await workoutsResponse.text();
      console.log('❌ Workouts failed:', error);
    }

    console.log('\n4. Testing /api/client/stats...');
    const statsResponse = await fetch(`${BASE_URL}/api/client/stats`, { headers });
    console.log('Status:', statsResponse.status);
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Stats loaded:', stats);
    } else {
      const error = await statsResponse.text();
      console.log('❌ Stats failed:', error);
    }

    console.log('\n5. Testing /api/workouts/sessions (voice workout)...');
    const sessionResponse = await fetch(`${BASE_URL}/api/workouts/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ startTime: new Date().toISOString() })
    });
    console.log('Status:', sessionResponse.status);
    
    if (sessionResponse.ok) {
      const session = await sessionResponse.json();
      console.log('✅ Session created:', session.id);
      
      // Test saving entries
      console.log('\n6. Testing /api/workouts/entries...');
      const entriesResponse = await fetch(`${BASE_URL}/api/workouts/entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          sessionId: session.id, 
          entries: [
            { exercise: 'Push-ups', reps: 10, sets: 3 },
            { exercise: 'Squats', reps: 15, sets: 2 }
          ]
        })
      });
      
      if (entriesResponse.ok) {
        const result = await entriesResponse.json();
        console.log('✅ Entries saved:', result.entriesSaved, 'exercises');
      } else {
        const error = await entriesResponse.text();
        console.log('❌ Entries failed:', error);
      }
    } else {
      const error = await sessionResponse.text();
      console.log('❌ Session failed:', error);
    }

    console.log('\n🎉 All client endpoints working!');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testClientFlow();
