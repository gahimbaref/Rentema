# Google Meet Integration Guide

This guide explains how to set up Google Meet integration for automated video call scheduling in your rental automation system.

## Overview

The system uses **Google Calendar API** to create calendar events with Google Meet links. This integration:
- ✅ **Free** - No API costs
- ✅ **Seamless** - Uses your existing Gmail OAuth
- ✅ **Automatic** - Creates Meet links when scheduling video calls
- ✅ **Calendar Integration** - Adds events to your Google Calendar
- ✅ **Email Invites** - Automatically sends calendar invites to tenants

## Prerequisites

You should already have:
1. Google Cloud Project with Gmail API enabled
2. OAuth 2.0 credentials (Client ID and Secret)
3. Gmail connection working in the app

## Setup Steps

### Step 1: Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the same one you used for Gmail)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Calendar API"
5. Click **Enable**

### Step 2: Update OAuth Scopes

The Gmail OAuth flow needs to request Calendar permissions:

1. In your Google Cloud Console, go to **APIs & Services** > **OAuth consent screen**
2. Click **Edit App**
3. Under **Scopes**, add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar` ← **Add this**
   - `https://www.googleapis.com/auth/calendar.events` ← **Add this**
4. Save changes

### Step 3: Get Refresh Token

Since you've already connected Gmail, you need to reconnect to get a new refresh token with Calendar permissions:

1. Start your application:
   ```bash
   npm run dev
   ```

2. Open the app in your browser: `http://localhost:3000`

3. Go to **Email Connection** page

4. Click **Disconnect** (if already connected)

5. Click **Connect Gmail Account**

6. Authorize the app (you'll see new Calendar permissions)

7. The refresh token is automatically saved in the database

### Step 4: Set Environment Variable

The refresh token is stored in the database, but you can also set it in `.env` for testing:

```env
# Gmail OAuth Configuration
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:5000/api/email/callback
GMAIL_REFRESH_TOKEN=your-refresh-token-from-database
```

To get the refresh token from the database:

```bash
psql -U postgres -d rentema -c "SELECT refresh_token FROM email_connections WHERE manager_id = 'your-manager-id';"
```

### Step 5: Test the Integration

Run the test script:

```bash
npx ts-node scripts/test-google-meet.ts
```

Expected output:
```
🧪 Testing Google Meet Integration

✅ Environment variables found
   Client ID: 358348181970-qbsne6...

📅 Creating test Google Meet...
   Summary: Test Property Viewing
   Time: 11/26/2025, 2:00:00 PM
   Duration: 30 minutes

✅ Google Meet created successfully!

Meeting Details:
   Event ID: abc123xyz
   Meet Link: https://meet.google.com/abc-defg-hij
   Calendar Link: https://calendar.google.com/event?eid=...

🗑️  Deleting test meeting...
✅ Test meeting deleted

✅ All tests passed! Google Meet integration is working correctly.
```

## How It Works

### 1. Video Call Scheduling

When a tenant books a video call:

```typescript
// In SchedulingEngine
const meeting = await this.meetService.createMeeting({
  summary: `Property Viewing - ${propertyAddress}`,
  startTime: scheduledTime,
  duration: 30,
  description: 'Video call to discuss the property',
});

// Returns: { id, meetLink, htmlLink }
```

### 2. Calendar Event Created

The system creates a Google Calendar event with:
- **Title**: "Property Viewing - [Address]"
- **Time**: Scheduled appointment time
- **Duration**: 30 minutes (configurable)
- **Google Meet link**: Automatically generated
- **Attendees**: Tenant's email (if provided)
- **Reminders**: 24 hours and 2 hours before

### 3. Email Sent

The tenant receives:
- Confirmation email with Meet link
- Calendar invite (.ics file)
- Automatic reminders from Google Calendar

## Features

### Automatic Calendar Invites

When creating a meeting, the system can automatically send calendar invites:

```typescript
const meeting = await meetService.createMeeting({
  summary: 'Property Viewing',
  startTime: new Date('2025-11-26T14:00:00'),
  duration: 30,
  attendeeEmail: 'tenant@example.com', // ← Sends invite
});
```

### Meeting Management

```typescript
// Get meeting details
const details = await meetService.getMeeting(eventId);

// Update meeting
await meetService.updateMeeting(eventId, {
  startTime: newTime,
  duration: 45,
});

// Cancel meeting
await meetService.deleteMeeting(eventId);
```

### Fallback Behavior

If Google Meet is not configured, the system generates placeholder links:

```
https://meet.google.com/abc-defg-hij
```

This allows development/testing without full setup.

## Troubleshooting

### Error: "Insufficient Permission"

**Problem**: OAuth token doesn't have Calendar permissions

**Solution**:
1. Disconnect Gmail in the app
2. Reconnect to get new token with Calendar scopes
3. Make sure Calendar API is enabled in Google Cloud Console

### Error: "Invalid Credentials"

**Problem**: Refresh token is invalid or expired

**Solution**:
1. Reconnect Gmail account in the app
2. Check that Client ID and Secret are correct
3. Verify redirect URI matches exactly

### Error: "Calendar API has not been used"

**Problem**: Calendar API not enabled

**Solution**:
1. Go to Google Cloud Console
2. Enable Google Calendar API
3. Wait a few minutes for propagation

### Meeting Link Not Generated

**Problem**: Conference data not created

**Solution**:
- Check that `conferenceDataVersion: 1` is set
- Verify `createRequest` has unique `requestId`
- Ensure Calendar API permissions are granted

## Comparison: Google Meet vs Zoom

| Feature | Google Meet | Zoom |
|---------|-------------|------|
| **Cost** | Free | Paid ($15+/month) |
| **Setup** | Uses existing Gmail OAuth | Requires separate account |
| **Integration** | Simple (Calendar API) | Complex (Zoom API) |
| **Meeting Limits** | Unlimited 1-on-1 | 40 min free tier |
| **Calendar** | Auto-syncs | Manual integration |
| **User Experience** | Browser-based | App required |
| **For Property Viewings** | ✅ Perfect | ⚠️ Overkill |

## Best Practices

1. **Always include attendee email** - Sends automatic calendar invites
2. **Set meaningful summaries** - Include property address
3. **Use consistent timezone** - Default to manager's timezone
4. **Handle errors gracefully** - Fall back to placeholder links
5. **Clean up cancelled meetings** - Delete calendar events

## Security Notes

- Refresh tokens are stored encrypted in the database
- OAuth tokens are refreshed automatically
- Calendar events are created in the manager's calendar
- Only the manager and invited attendees can see events

## Next Steps

Once Google Meet is working:

1. ✅ Test video call scheduling in the app
2. ✅ Verify calendar invites are sent
3. ✅ Check that Meet links work
4. ✅ Test cancellation flow
5. ✅ Monitor logs for any errors

## Support

If you encounter issues:

1. Check the logs: `tail -f logs/app.log`
2. Run the test script: `npx ts-node scripts/test-google-meet.ts`
3. Verify OAuth scopes in Google Cloud Console
4. Ensure Calendar API is enabled

---

**Note**: This integration uses the same Gmail OAuth credentials you already have. No additional Google accounts or API keys needed!
