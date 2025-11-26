# Zoom to Google Meet Migration Guide

This document explains the changes made to replace Zoom with Google Meet for video call scheduling.

## Summary of Changes

✅ **Replaced** Zoom API with Google Calendar API + Google Meet
✅ **Reused** existing Gmail OAuth credentials
✅ **Maintained** database compatibility (kept `zoom_link` column name)
✅ **Updated** UI references from "Zoom" to "Google Meet"
✅ **Added** Calendar API scopes to OAuth flow

## What Changed

### 1. New Service: GoogleMeetService

**File**: `src/engines/GoogleMeetService.ts`

Replaces `ZoomService.ts` with Google Calendar API integration:

```typescript
// Old (Zoom)
const meeting = await zoomService.createMeeting({
  topic: 'Property Viewing',
  startTime: date,
  duration: 30
});
// Returns: { id, joinUrl, startUrl, password }

// New (Google Meet)
const meeting = await meetService.createMeeting({
  summary: 'Property Viewing',
  startTime: date,
  duration: 30
});
// Returns: { id, meetLink, htmlLink }
```

### 2. Updated SchedulingEngine

**File**: `src/engines/SchedulingEngine.ts`

- Replaced `ZoomService` with `GoogleMeetService`
- Updated initialization to use Gmail credentials
- Renamed `createZoomMeeting()` to `createGoogleMeet()`
- Updated fallback placeholder links

### 3. OAuth Scopes Added

**File**: `src/engines/OAuthManager.ts`

Added Calendar scopes to Gmail OAuth:

```typescript
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar', // NEW
  'https://www.googleapis.com/auth/calendar.events' // NEW
];
```

### 4. UI Updates

**Files Updated**:
- `client/src/pages/SchedulingPage.tsx` - "Zoom Link" → "Google Meet Link"
- `src/engines/SchedulingLinkGenerator.ts` - "Join Zoom Meeting" → "Join Google Meet"

### 5. Environment Variables

**File**: `.env`

```env
# OLD - Zoom credentials (no longer needed)
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...

# NEW - Uses existing Gmail credentials
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=...
GMAIL_REFRESH_TOKEN=... # Auto-populated from database
```

### 6. Database Schema

**No changes required!** The `appointments` table still uses `zoom_link` column for backward compatibility:

```sql
CREATE TABLE appointments (
  ...
  zoom_link TEXT, -- Now contains Google Meet links
  ...
);
```

## Migration Steps

### For Existing Installations

1. **Enable Google Calendar API**
   ```bash
   # Go to Google Cloud Console
   # Enable "Google Calendar API" for your project
   ```

2. **Update OAuth Scopes**
   ```bash
   # In Google Cloud Console > OAuth consent screen
   # Add Calendar scopes (see OAuthManager.ts)
   ```

3. **Reconnect Gmail**
   ```bash
   # In the app:
   # 1. Go to Email Connection page
   # 2. Click "Disconnect"
   # 3. Click "Connect Gmail Account"
   # 4. Authorize with new Calendar permissions
   ```

4. **Test Integration**
   ```bash
   npx ts-node scripts/test-google-meet.ts
   ```

5. **Remove Zoom Credentials** (optional)
   ```bash
   # Remove from .env:
   # ZOOM_ACCOUNT_ID
   # ZOOM_CLIENT_ID
   # ZOOM_CLIENT_SECRET
   ```

### For New Installations

Just follow the normal setup - Google Meet is now the default!

## Benefits of Google Meet

| Aspect | Zoom | Google Meet |
|--------|------|-------------|
| **Cost** | $15+/month | Free |
| **Setup Complexity** | High (separate OAuth) | Low (reuses Gmail) |
| **API Calls** | Separate API | Calendar API |
| **Meeting Limits** | 40 min (free tier) | Unlimited 1-on-1 |
| **User Experience** | App required | Browser-based |
| **Calendar Integration** | Manual | Automatic |
| **Email Invites** | Manual | Automatic |

## Backward Compatibility

### Existing Appointments

Old Zoom links in the database will continue to work:
- Database column name unchanged (`zoom_link`)
- UI displays any link in that field
- No data migration needed

### API Responses

The API still returns `zoomLink` field:

```typescript
interface Appointment {
  ...
  zoomLink?: string; // Now contains Google Meet links
  ...
}
```

## Testing

### Unit Tests

No changes needed - tests use mock data.

### Integration Tests

Update test data to use Google Meet links:

```typescript
// Old
zoomLink: 'https://zoom.us/j/123456789'

// New
zoomLink: 'https://meet.google.com/abc-defg-hij'
```

### Manual Testing

1. Schedule a video call appointment
2. Verify Google Meet link is generated
3. Check calendar event is created
4. Confirm email invite is sent
5. Test joining the meeting

## Troubleshooting

### "Insufficient Permission" Error

**Cause**: OAuth token doesn't have Calendar scopes

**Fix**: Reconnect Gmail account to get new token with Calendar permissions

### "Calendar API has not been used" Error

**Cause**: Calendar API not enabled in Google Cloud

**Fix**: Enable Google Calendar API in Google Cloud Console

### Placeholder Links Generated

**Cause**: Google Meet service not initialized

**Fix**: 
1. Check `GMAIL_REFRESH_TOKEN` is set
2. Verify Calendar API is enabled
3. Check logs for initialization errors

## Rollback Plan

If you need to revert to Zoom:

1. Restore `ZoomService.ts` from git history
2. Update `SchedulingEngine.ts` to use `ZoomService`
3. Revert OAuth scopes in `OAuthManager.ts`
4. Add back Zoom credentials to `.env`
5. Update UI references back to "Zoom"

## Files Modified

### Core Services
- ✅ `src/engines/GoogleMeetService.ts` (NEW)
- ✅ `src/engines/SchedulingEngine.ts`
- ✅ `src/engines/OAuthManager.ts`

### UI Components
- ✅ `client/src/pages/SchedulingPage.tsx`
- ✅ `src/engines/SchedulingLinkGenerator.ts`
- ✅ `src/engines/TemplateEngine.ts`

### Configuration
- ✅ `.env`
- ✅ `package.json` (googleapis already installed)

### Documentation
- ✅ `docs/GOOGLE_MEET_INTEGRATION_GUIDE.md` (NEW)
- ✅ `docs/ZOOM_TO_GOOGLE_MEET_MIGRATION.md` (NEW)

### Scripts
- ✅ `scripts/test-google-meet.ts` (NEW)

### Deprecated (can be removed)
- ⚠️ `src/engines/ZoomService.ts`
- ⚠️ `scripts/test-zoom-integration.ts`
- ⚠️ `docs/ZOOM_INTEGRATION_GUIDE.md`
- ⚠️ `docs/ZOOM_TROUBLESHOOTING.md`

## Next Steps

1. ✅ Test Google Meet integration
2. ✅ Update any custom scripts that reference Zoom
3. ✅ Remove Zoom credentials from production
4. ✅ Archive Zoom documentation
5. ✅ Monitor logs for any issues

---

**Migration completed successfully!** 🎉

Google Meet is now your default video calling solution.
