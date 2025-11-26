import axios from 'axios';

async function checkAPIHealth() {
  console.log('🔍 Checking API Health...\n');

  try {
    // Check if backend is responding
    const response = await axios.get('http://localhost:5000/api/properties', {
      headers: {
        'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
      },
      validateStatus: () => true // Don't throw on any status
    });

    console.log(`✅ Backend is responding`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);

    if (response.status === 401) {
      console.log('\n⚠️  Authentication required - you need to log in');
      console.log('Try logging in at: http://localhost:3000/login');
    }

  } catch (error: any) {
    console.error('❌ Backend connection failed:', error.message);
    console.log('\n💡 Make sure the backend server is running:');
    console.log('   npm run dev (in the root directory)');
  }
}

checkAPIHealth();
