# Video Call Workflow Fix

## Issues Fixed

### 1. Wrong Appointment Type After Qualification
**Problem**: After pre-qualification, the system was scheduling property tours instead of video calls.

**Solution**: Changed the appointment type in `EmailWorkflowOrchestrator.ts` from `'tour'` to `'video_call'`:

```typescript
// Before
const schedulingLinks = await this.schedulingLinkGen.generateSchedulingLinks(inquiryId, {
  appointmentType: 'tour',
  daysAhead: 7,
  minSlotsToShow: 5,
});

// After
const schedulingLinks = await this.schedulingLinkGen.generateSchedulingLinks(inquiryId, {
  appointmentType: 'video_call',  // First step is video call
  daysAhead: 7,
  minSlotsToShow: 5,
});
```

### 2. Email Template Updated
**Problem**: Email template mentioned "viewing" instead of "video call".

**Solution**: Updated the `qualified_scheduling` template in `defaultEmailTemplates.ts`:
- Changed subject from "Schedule Your Viewing" to "Schedule Your Video Call"
- Updated body text to clarify it's a video call
- Added mention of Zoom link being sent after confirmation

### 3. Time Slots Displaying as [object Object]
**Problem**: Email was showing `[object Object]` instead of formatted time slots.

**Solution**: Updated `EmailSenderService.renderTemplate()` to handle the `timeSlots` array specially:

```typescript
// Special handling for timeSlots array
if (key === 'timeSlots' && Array.isArray(value)) {
  const timeSlotsHtml = value.map((slot: any) => 
    `<a href="${slot.bookingLink}" style="display: block; padding: 15px; margin: 10px 0; background: #f8f9ff; border: 2px solid #667eea; border-radius: 8px; text-decoration: none; color: #333; text-align: center; font-weight: 500;">${slot.time}</a>`
  ).join('\n');
  rendered = rendered.replace(placeholder, timeSlotsHtml);
}
```

## Workflow Now

1. **Email Inquiry** → Inquiry created
2. **Questionnaire Sent** → Token generated
3. **Questionnaire Completed** → Responses stored
4. **Qualification Evaluated** → Tenant qualified
5. **Video Call Scheduling Email Sent** → 8-10 video call slots offered
6. **Tenant Clicks Time Slot** → Redirected to booking page
7. **Tenant Confirms** → Video call appointment created with Zoom link
8. **After Video Call** → Property tour can be scheduled (future enhancement)

## Testing

To test the complete workflow:

```bash
# 1. Send questionnaire
npx ts-node scripts/send-questionnaire-email.ts

# 2. Fill out questionnaire at the provided link with qualifying answers

# 3. Trigger qualification (or it happens automatically on submit)
npx ts-node scripts/test-questionnaire-submission.ts

# 4. Check email for video call scheduling links

# 5. Click a time slot link to book
```

## Configuration

Ensure these environment variables are set correctly:

```env
CLIENT_URL=http://localhost:3000
MANAGER_EMAIL=your-email@example.com
MANAGER_PHONE=(555) 123-4567
```

## Next Steps

After the video call is completed, the workflow could be extended to:
1. Send a follow-up email asking if they want to schedule an in-person tour
2. Generate tour scheduling links (using `appointmentType: 'tour'`)
3. Confirm tour appointment
4. Send tour confirmation with property address and directions

This creates a natural progression:
**Questionnaire → Video Call → Property Tour → Application**


## Confirmation Email Added

**Problem**: After booking an appointment, tenants weren't receiving a confirmation email.

**Solution**: Added `sendConfirmationEmail()` method to `SchedulingLinkGenerator.bookAppointment()`:

```typescript
private async sendConfirmationEmail(inquiry: any, appointment: any, property: any): Promise<void> {
  // Get connection ID and tenant email from inquiry
  // Format appointment details
  // Send confirmation email using appointment_confirmation template
  // Includes: date, time, duration, Zoom link (for video calls)
}
```

The confirmation email includes:
- Appointment date and time
- Duration
- Appointment type (Video Call or In-Person Tour)
- Zoom link (for video calls)
- Cancellation link (future feature)

## Complete Workflow Now:

1. **Email Inquiry** → Inquiry created
2. **Questionnaire Sent** → Token generated  
3. **Questionnaire Completed** → Responses stored
4. **Qualification Evaluated** → Tenant qualified
5. **Video Call Scheduling Email Sent** → 8-10 video call slots offered
6. **Tenant Clicks Time Slot** → Redirected to booking page
7. **Tenant Confirms** → Video call appointment created with Zoom link
8. **✅ Confirmation Email Sent** → Tenant receives appointment details

All emails are now working correctly! 🎉
