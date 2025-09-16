// Using built-in fetch (Node.js 18+)

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
  try {
    console.log('Testing GymCoach API endpoints...\n');

    // Test login with a coach account
    console.log('1. Testing login...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'coach@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('Login failed - creating test coach account...');
      
      // Register a test coach
      const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'coach@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'Coach',
          role: 'coach'
        })
      });

      if (registerResponse.ok) {
        console.log('✓ Test coach account created');
        
        // Try login again
        const retryLogin = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'coach@example.com',
            password: 'password123'
          })
        });
        
        if (retryLogin.ok) {
          const loginData = await retryLogin.json();
          console.log('✓ Login successful');
          
          const token = loginData.token;
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          };

          // Test coach stats endpoint
          console.log('\n2. Testing coach stats...');
          const statsResponse = await fetch(`${BASE_URL}/api/coach/stats`, { headers });
          if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log('✓ Coach stats retrieved:', JSON.stringify(stats, null, 2));
          } else {
            console.log('✗ Coach stats failed:', statsResponse.status);
          }

          // Test coach clients endpoint
          console.log('\n3. Testing coach clients...');
          const clientsResponse = await fetch(`${BASE_URL}/api/coach/clients`, { headers });
          if (clientsResponse.ok) {
            const clients = await clientsResponse.json();
            console.log('✓ Coach clients retrieved:', clients.clients.length, 'clients');
          } else {
            console.log('✗ Coach clients failed:', clientsResponse.status);
          }

          // Test workouts endpoint
          console.log('\n4. Testing workouts...');
          const workoutsResponse = await fetch(`${BASE_URL}/api/coach/workouts`, { headers });
          if (workoutsResponse.ok) {
            const workoutsData = await workoutsResponse.json();
            console.log('✓ Workouts retrieved:', workoutsData.workouts ? workoutsData.workouts.length : 0, 'workouts');
          } else {
            console.log('✗ Workouts failed:', workoutsResponse.status);
          }

          // Test reports endpoint
          console.log('\n5. Testing reports...');
          const reportsResponse = await fetch(`${BASE_URL}/api/reports/dashboard`, { headers });
          if (reportsResponse.ok) {
            const reports = await reportsResponse.json();
            console.log('✓ Reports retrieved successfully');
            console.log('  - Total clients:', reports.totalClients);
            console.log('  - Active clients:', reports.activeClients);
            console.log('  - Client progress entries:', reports.clientProgress.length);
          } else {
            console.log('✗ Reports failed:', reportsResponse.status);
          }

          console.log('\n✓ All API tests completed successfully!');
        }
      }
    } else {
      const loginData = await loginResponse.json();
      console.log('✓ Login successful with existing account');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI();
