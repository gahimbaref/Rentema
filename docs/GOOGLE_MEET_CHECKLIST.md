# Google Meet Integration Checklist

Use this checklist to set up Google Meet for your rental automation system.

## ✅ Pre-Setup (Already Done)

- [x] Gmail OAuth configured
- [x] Gmail API enabled
- [x] Email connection working in app
- [x] Code updated to use Google Meet

## 📋 Setup Steps

### 1. Enable Google Calendar API

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Select your project
- [ ] Navigate to **APIs & Services** > **Library**
- [ ] Search for "Google Calendar API"
- [ ] Click **Enable**
- [ ] Wait 1-2 minutes for propagation

### 2. Update OAuth Consent Screen

- [ ] Go to **APIs & Services** > **OAuth consent screen**
- [ ] Click **Edit App**
- [ ] Scroll to **Scopes** section
- [ ] Click **Add or Remove Scopes**
- [ ] Find and check these scopes:
  - [ ] `https://www.googleapis.com/auth/calendar`
  - [ ] `https://www.googleapis.com/auth/calendar.events`
- [ ] Click **Update**
- [ ] Click **Save and Continue**

### 3. Reconnect Gmail Account

- [ ] Start your application: `npm run dev`
- [ ] Open browser: `http://localhost:3000`
- [ ] Log in to your account
- [ ] Go to **Email Connection** page
- [ ] If already connected, click **Disconnect**
- [ ] Click **Connect Gmail Account**
- [ ] Review permissions (you'll see Calendar access)
- [ ] Click **Allow**
- [ ] Verify connection shows as "Connected"

### 4. Test the Integration

- [ ] Open terminal
- [ ] Run: `npx ts-node scripts/test-google-meet.ts`
- [ ] Verify output shows:
  - [ ] ✅ Environment variables found
  - [ ] ✅ Google Meet created successfully
  - [ ] Meet Link displayed
  - [ ] ✅ Test meeting deleted
  - [ ] ✅ All tests passed

### 5. Test in Application

- [ ] Create a test property (or use existing)
- [ ] Set up video call availability
- [ ] Create a test inquiry
- [ ] Schedule a video call appointment
- [ ] Verify:
  - [ ] Google Meet link is generated
  - [ ] Link format: `https://meet.google.com/xxx-xxxx-xxx`
  - [ ] Calendar event appears in your Google Calendar
  - [ ] Event has Google Meet link attached

### 6. Test Email Flow (Optional)

- [ ] Schedule video call with tenant email
- [ ] Check tenant receives:
  - [ ] Confirmation email with Meet link
  - [ ] Calendar invite (.ics file)
- [ ] Verify calendar invite:
  - [ ] Has correct date/time
  - [ ] Includes Google Meet link
  - [ ] Shows in tenant's calendar

### 7. Cleanup (Optional)

- [ ] Remove Zoom credentials from `.env`:
  ```bash
  # Remove these lines:
  ZOOM_ACCOUNT_ID=...
  ZOOM_CLIENT_ID=...
  ZOOM_CLIENT_SECRET=...
  ```
- [ ] Archive old Zoom documentation
- [ ] Delete `src/engines/ZoomService.ts` (if desired)
- [ ] Delete `scripts/test-zoom-integration.ts` (if desired)

## 🔍 Verification

### Quick Checks

- [ ] No TypeScript errors in new files
- [ ] Application starts without errors
- [ ] Email connection still works
- [ ] Can schedule appointments
- [ ] Google Meet links are generated

### Full Test

- [ ] Create end-to-end test:
  1. [ ] New inquiry comes in
  2. [ ] Tenant completes questionnaire
  3. [ ] Tenant qualifies
  4. [ ] Tenant books video call
  5. [ ] Google Meet link generated
  6. [ ] Calendar event created
  7. [ ] Confirmation email sent
  8. [ ] Can join meeting via link

## 🚨 Troubleshooting

### Issue: "Insufficient Permission"

**Symptom**: Error when creating meetings

**Fix**:
- [ ] Disconnect Gmail in app
- [ ] Reconnect Gmail
- [ ] Ensure Calendar scopes are added in OAuth consent screen

### Issue: "Calendar API has not been used"

**Symptom**: API error when creating meetings

**Fix**:
- [ ] Enable Calendar API in Google Cloud Console
- [ ] Wait 2-3 minutes
- [ ] Try again

### Issue: Placeholder Links Generated

**Symptom**: Links like `https://meet.google.com/abc123` (random)

**Fix**:
- [ ] Check `GMAIL_REFRESH_TOKEN` is set
- [ ] Verify Calendar API is enabled
- [ ] Check application logs for errors
- [ ] Reconnect Gmail account

### Issue: No Calendar Event Created

**Symptom**: Meet link works but no calendar event

**Fix**:
- [ ] Verify Calendar API is enabled
- [ ] Check OAuth scopes include Calendar
- [ ] Review application logs
- [ ] Test with `scripts/test-google-meet.ts`

## 📚 Documentation Reference

- **Quick Start**: `docs/GOOGLE_MEET_SETUP_QUICK_START.md`
- **Full Guide**: `docs/GOOGLE_MEET_INTEGRATION_GUIDE.md`
- **Migration Details**: `docs/ZOOM_TO_GOOGLE_MEET_MIGRATION.md`
- **Completion Summary**: `docs/GOOGLE_MEET_MIGRATION_COMPLETE.md`

## ✅ Success Criteria

You're done when:

- [x] Calendar API is enabled
- [x] OAuth scopes include Calendar
- [x] Gmail is reconnected with new permissions
- [x] Test script passes
- [x] Can schedule video calls in app
- [x] Google Meet links are generated
- [x] Calendar events are created
- [x] No errors in application logs

## 🎉 Completion

Once all items are checked:

- [ ] Mark this checklist as complete
- [ ] Document any issues encountered
- [ ] Share setup time (should be ~5-10 minutes)
- [ ] Celebrate! 🎊

---

**Estimated Time**: 5-10 minutes

**Difficulty**: Easy (if Gmail already working)

**Support**: Check documentation in `docs/` folder
