// Test export endpoints
const BASE_URL = 'http://localhost:3001';

async function testExports() {
  try {
    console.log('🧪 Testing Export Endpoints\n');

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
      'Authorization': `Bearer ${token}`
    };

    console.log('✅ Authentication successful\n');

    // Test CSV export
    console.log('Testing CSV Export...');
    const csvResponse = await fetch(`${BASE_URL}/api/reports/export/csv`, { headers });
    
    console.log('CSV Response Status:', csvResponse.status);
    console.log('CSV Response Headers:', Object.fromEntries(csvResponse.headers.entries()));
    
    if (csvResponse.ok) {
      const csvContent = await csvResponse.text();
      console.log('✅ CSV Export successful');
      console.log('CSV Content Preview:', csvContent.substring(0, 200) + '...');
    } else {
      const errorText = await csvResponse.text();
      console.log('❌ CSV Export failed');
      console.log('Error:', errorText.substring(0, 500));
    }

    console.log('\n' + '-'.repeat(50) + '\n');

    // Test PDF export
    console.log('Testing PDF Export...');
    const pdfResponse = await fetch(`${BASE_URL}/api/reports/export/pdf`, { headers });
    
    console.log('PDF Response Status:', pdfResponse.status);
    console.log('PDF Response Headers:', Object.fromEntries(pdfResponse.headers.entries()));
    
    if (pdfResponse.ok) {
      const pdfContent = await pdfResponse.text();
      console.log('✅ PDF Export successful');
      console.log('PDF Content Preview:', pdfContent.substring(0, 300) + '...');
    } else {
      const errorText = await pdfResponse.text();
      console.log('❌ PDF Export failed');
      console.log('Error:', errorText.substring(0, 500));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExports();
