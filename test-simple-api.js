import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testSimpleAPI() {
  try {
    console.log('Testing /api/health...');
    const response = await fetch(`${BASE_URL}/api/health`);
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
    
    if (text.startsWith('<!DOCTYPE')) {
      console.log('❌ Server is returning HTML instead of API responses');
      console.log('This suggests the frontend is being served on API routes');
    } else {
      console.log('✅ API working correctly');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testSimpleAPI();
