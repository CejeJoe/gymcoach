import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testClientEndpoints() {
  console.log('🔍 Testing Client Endpoints\n');

  try {
    // Login as a client user first
    console.log('1. Logging in as client...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.doe@example.com', // This should be a client user
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Client login failed:', loginResponse.status);
      // Try creating a client user
      console.log('2. Trying to register as client...');
      const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testclient@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'Client',
          role: 'client'
        })
      });
      
      if (!registerResponse.ok) {
        console.log('❌ Client registration failed:', registerResponse.status);
        return;
      }
      
      const { token, user } = await registerResponse.json();
      console.log('✅ Client registered:', user.firstName, user.lastName);
      
      // Test endpoints with new client
      await testEndpoints(token, user);
      return;
    }

    const { token, user } = await loginResponse.json();
    console.log('✅ Logged in as:', user.firstName, user.lastName, '(Role:', user.role + ')');
    
    if (user.role !== 'client') {
      console.log('❌ User is not a client, role is:', user.role);
      return;
    }

    await testEndpoints(token, user);

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testEndpoints(token, user) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('\n📋 Testing client endpoints...');

  // Test /api/client/profile
  console.log('\n3. Testing /api/client/profile...');
  try {
    const profileResponse = await fetch(`${BASE_URL}/api/client/profile`, { headers });
    console.log('Profile response status:', profileResponse.status);
    
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Profile loaded:', {
        id: profile.id,
        coachId: profile.coachId,
        userId: profile.userId
      });
    } else {
      const error = await profileResponse.text();
      console.log('❌ Profile failed:', error);
    }
  } catch (error) {
    console.log('❌ Profile error:', error.message);
  }

  // Test /api/client/stats
  console.log('\n4. Testing /api/client/stats...');
  try {
    const statsResponse = await fetch(`${BASE_URL}/api/client/stats`, { headers });
    console.log('Stats response status:', statsResponse.status);
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Stats loaded:', stats);
    } else {
      const error = await statsResponse.text();
      console.log('❌ Stats failed:', error);
    }
  } catch (error) {
    console.log('❌ Stats error:', error.message);
  }

  // Test /api/client/workouts
  console.log('\n5. Testing /api/client/workouts...');
  try {
    const workoutsResponse = await fetch(`${BASE_URL}/api/client/workouts`, { headers });
    console.log('Workouts response status:', workoutsResponse.status);
    
    if (workoutsResponse.ok) {
      const workouts = await workoutsResponse.json();
      console.log('✅ Workouts loaded:', workouts.length, 'workouts');
    } else {
      const error = await workoutsResponse.text();
      console.log('❌ Workouts failed:', error);
    }
  } catch (error) {
    console.log('❌ Workouts error:', error.message);
  }

  // Test /api/client/progress
  console.log('\n6. Testing /api/client/progress...');
  try {
    const progressResponse = await fetch(`${BASE_URL}/api/client/progress`, { headers });
    console.log('Progress response status:', progressResponse.status);
    
    if (progressResponse.ok) {
      const progress = await progressResponse.json();
      console.log('✅ Progress loaded:', progress.length, 'entries');
    } else {
      const error = await progressResponse.text();
      console.log('❌ Progress failed:', error);
    }
  } catch (error) {
    console.log('❌ Progress error:', error.message);
  }

  // Test workout session creation
  console.log('\n7. Testing /api/workouts/sessions...');
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

testClientEndpoints();
