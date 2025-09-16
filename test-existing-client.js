import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testExistingClient() {
  console.log('🔍 Testing with existing client user\n');

  try {
    // Try to login with existing client users from the database
    const clientEmails = [
      'john.doe@example.com',
      'jane.smith@example.com', 
      'mike.johnson@example.com'
    ];

    let token = null;
    let user = null;

    for (const email of clientEmails) {
      console.log(`Trying to login as: ${email}`);
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: 'password123'
        })
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        token = loginData.token;
        user = loginData.user;
        console.log('✅ Logged in as:', user.firstName, user.lastName, '(Role:', user.role + ')');
        break;
      } else {
        console.log('❌ Login failed for', email, '- Status:', loginResponse.status);
      }
    }

    if (!token) {
      console.log('❌ Could not login with any existing client');
      return;
    }

    if (user.role !== 'client') {
      console.log('❌ User is not a client, role is:', user.role);
      return;
    }

    await testClientEndpoints(token, user);

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testClientEndpoints(token, user) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('\n📋 Testing client endpoints...');

  // Test /api/client/profile
  console.log('\n1. Testing /api/client/profile...');
  try {
    const profileResponse = await fetch(`${BASE_URL}/api/client/profile`, { headers });
    console.log('Profile response status:', profileResponse.status);
    
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Profile loaded:', {
        id: profile.id,
        coachId: profile.coachId,
        userId: profile.userId,
        goals: profile.goals
      });
    } else {
      const error = await profileResponse.text();
      console.log('❌ Profile failed:', error);
    }
  } catch (error) {
    console.log('❌ Profile error:', error.message);
  }

  // Test /api/client/workouts
  console.log('\n2. Testing /api/client/workouts...');
  try {
    const workoutsResponse = await fetch(`${BASE_URL}/api/client/workouts`, { headers });
    console.log('Workouts response status:', workoutsResponse.status);
    
    if (workoutsResponse.ok) {
      const workouts = await workoutsResponse.json();
      console.log('✅ Workouts loaded:', workouts.length, 'workouts');
      if (workouts.length > 0) {
        console.log('First workout:', workouts[0].name);
      }
    } else {
      const error = await workoutsResponse.text();
      console.log('❌ Workouts failed:', error);
    }
  } catch (error) {
    console.log('❌ Workouts error:', error.message);
  }

  // Test /api/workouts/sessions
  console.log('\n3. Testing /api/workouts/sessions...');
  try {
    const sessionResponse = await fetch(`${BASE_URL}/api/workouts/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ startTime: new Date().toISOString() })
    });
    console.log('Session response status:', sessionResponse.status);
    
    if (sessionResponse.ok) {
      const session = await sessionResponse.json();
      console.log('✅ Session created:', session.id);
    } else {
      const error = await sessionResponse.text();
      console.log('❌ Session failed:', error);
    }
  } catch (error) {
    console.log('❌ Session error:', error.message);
  }
}

testExistingClient();
