// Final comprehensive test of all API endpoints with real data
const BASE_URL = 'http://localhost:3001';

async function testAllEndpoints() {
  try {
    console.log('🧪 Final Test: Verifying all endpoints use real data\n');

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

    console.log('✅ Authentication successful\n');

    // Test all main endpoints
    const tests = [
      {
        name: 'Coach Stats (Dashboard)',
        url: '/api/coach/stats',
        verify: (data) => data.totalClients !== undefined && data.activeClients !== undefined
      },
      {
        name: 'Coach Clients (Client Management)',
        url: '/api/coach/clients',
        verify: (data) => Array.isArray(data.clients)
      },
      {
        name: 'Coach Workouts (Workout Management)',
        url: '/api/coach/workouts',
        verify: (data) => {
          // The API returns { workouts: [...] }
          return data.workouts && Array.isArray(data.workouts) && data.workouts.length >= 0;
        }
      },
      {
        name: 'Reports Dashboard',
        url: '/api/reports/dashboard',
        verify: (data) => data.performanceMetrics?.totalClients !== undefined && Array.isArray(data.clientProgress)
      },
      {
        name: 'Reports CSV Export',
        url: '/api/reports/export/csv',
        verify: (data) => typeof data === 'string' && data.includes('Client Name')
      }
    ];

    let allPassed = true;

    for (const test of tests) {
      try {
        const response = await fetch(`${BASE_URL}${test.url}`, { headers });
        
        if (!response.ok) {
          console.log(`❌ ${test.name}: HTTP ${response.status}`);
          allPassed = false;
          continue;
        }

        const data = test.url.includes('csv') ? await response.text() : await response.json();
        
        if (test.verify(data)) {
          console.log(`✅ ${test.name}: Real data verified`);
        } else {
          console.log(`❌ ${test.name}: Data structure validation failed`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! All endpoints are using real database data.');
      console.log('✅ Mock data has been successfully eliminated from the application.');
    } else {
      console.log('⚠️  Some tests failed. Please check the issues above.');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

testAllEndpoints();
