import fetch from 'node-fetch';

async function testMessages() {
  console.log('🔍 Testing Messages Functionality\n');

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

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Logged in as:', loginData.user.firstName, loginData.user.lastName);
    
    const token = loginData.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Get client profile to get coachId
    const profileResponse = await fetch('http://localhost:3001/api/client/profile', {
      headers
    });

    if (!profileResponse.ok) {
      throw new Error(`Profile fetch failed: ${profileResponse.status}`);
    }

    const profile = await profileResponse.json();
    console.log('✅ Profile loaded - Coach ID:', profile.coachId);

    // 3. Test messages thread endpoint
    console.log('\n3. Testing /api/messages/thread...');
    const messagesResponse = await fetch(`http://localhost:3001/api/messages/thread/${profile.coachId}/${profile.id}`, {
      headers
    });

    console.log('Status:', messagesResponse.status);
    
    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();
      console.log('✅ Messages loaded:', messages.length, 'messages');
    } else {
      const errorText = await messagesResponse.text();
      console.log('❌ Messages failed:', errorText);
    }

    // 4. Test sending a message
    console.log('\n4. Testing message sending...');
    const sendResponse = await fetch(`http://localhost:3001/api/messages/thread/${profile.coachId}/${profile.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: 'Test message from client'
      })
    });

    console.log('Send Status:', sendResponse.status);
    
    if (sendResponse.ok) {
      const sentMessage = await sendResponse.json();
      console.log('✅ Message sent:', sentMessage.id);
    } else {
      const errorText = await sendResponse.text();
      console.log('❌ Send failed:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMessages();
