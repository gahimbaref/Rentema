# Google Meet Setup - Quick Start

## 🚀 5-Minute Setup

### Step 1: Enable Calendar API (1 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Library**
4. Search "Google Calendar API" → Click **Enable**

### Step 2: Update OAuth Scopes (2 min)

1. Go to **APIs & Services** > **OAuth consent screen**
2. Click **Edit App**
3. Under **Scopes**, click **Add or Remove Scopes**
4. Add these two scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Click **Update** → **Save and Continue**

### Step 3: Reconnect Gmail (1 min)

1. Start your app: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Go to **Email Connection** page
4. Click **Disconnect** (if connected)
5. Click **Connect Gmail Account**
6. Authorize (you'll see new Calendar permissions)

### Step 4: Test It (1 min)

```bash
npx ts-node scripts/test-google-meet.ts
```

Expected output:
```
✅ Google Meet created successfully!
Meeting Details:
   Meet Link: https://meet.google.com/abc-defg-hij
```

## ✅ Done!

Video calls will now automatically create Google Meet links.

## What You Get

- ✅ Free Google Meet links for all video calls
- ✅ Automatic calendar events
- ✅ Email invites sent to tenants
- ✅ Reminders (24h and 2h before)
- ✅ No additional setup needed

## Troubleshooting

### "Insufficient Permission" Error

You need to reconnect Gmail with Calendar permissions:
1. Disconnect Gmail in the app
2. Reconnect Gmail
3. Authorize Calendar access

### "Calendar API has not been used" Error

Enable Calendar API in Google Cloud Console (Step 1 above).

### Still Having Issues?

Check the full guide: [GOOGLE_MEET_INTEGRATION_GUIDE.md](./GOOGLE_MEET_INTEGRATION_GUIDE.md)

---

**That's it!** Google Meet is now integrated with your rental automation system. 🎉
