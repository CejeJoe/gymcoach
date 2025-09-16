import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testClientDirect() {
  try {
    // First login to get a valid token
    console.log('1. Logging in...');
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

    const { token } = await loginResponse.json();
    console.log('✅ Login successful');

    // Test client profile endpoint directly
    console.log('\n2. Testing /api/client/profile directly...');
    const profileResponse = await fetch(`${BASE_URL}/api/client/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status:', profileResponse.status);
    console.log('Content-Type:', profileResponse.headers.get('content-type'));
    
    const text = await profileResponse.text();
    console.log('Response length:', text.length);
    console.log('First 200 chars:', text.substring(0, 200));

    if (text.startsWith('<!DOCTYPE')) {
      console.log('❌ Still getting HTML instead of JSON');
      console.log('This suggests the client routes are not properly registered');
    } else {
      try {
        const json = JSON.parse(text);
        console.log('✅ Got JSON response:', json);
      } catch (e) {
        console.log('❌ Response is not valid JSON:', e.message);
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testClientDirect();
