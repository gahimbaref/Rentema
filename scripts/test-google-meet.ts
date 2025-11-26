import dotenv from 'dotenv';
import { GoogleMeetService } from '../src/engines/GoogleMeetService';

dotenv.config();

async function testGoogleMeet() {
  console.log('🧪 Testing Google Meet Integration\n');

  // Check environment variables
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    console.error('❌ Missing required environment variables:');
    console.error('   - GMAIL_CLIENT_ID');
    console.error('   - GMAIL_CLIENT_SECRET');
    console.error('   - GMAIL_REFRESH_TOKEN');
    console.error('\nPlease set these in your .env file.');
    console.error('You can get the refresh token by connecting your Gmail account in the app.');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log(`   Client ID: ${process.env.GMAIL_CLIENT_ID.substring(0, 20)}...`);

  const meetService = new GoogleMeetService(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/email/callback',
    process.env.GMAIL_REFRESH_TOKEN
  );

  try {
    // Create a test meeting for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow

    console.log('\n📅 Creating test Google Meet...');
    console.log(`   Summary: Test Property Viewing`);
    console.log(`   Time: ${tomorrow.toLocaleString()}`);
    console.log(`   Duration: 30 minutes\n`);

    const meeting = await meetService.createMeeting({
      summary: 'Test Property Viewing',
      startTime: tomorrow,
      duration: 30,
      description: 'This is a test meeting created by the rental automation system',
    });

    console.log('✅ Google Meet created successfully!\n');
    console.log('Meeting Details:');
    console.log(`   Event ID: ${meeting.id}`);
    console.log(`   Meet Link: ${meeting.meetLink}`);
    console.log(`   Calendar Link: ${meeting.htmlLink}`);

    // Clean up - delete the test meeting
    console.log('\n🗑️  Deleting test meeting...');
    await meetService.deleteMeeting(meeting.id);
    console.log('✅ Test meeting deleted');

    console.log('\n✅ All tests passed! Google Meet integration is working correctly.');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testGoogleMeet();
