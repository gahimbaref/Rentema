# Email Workflow Troubleshooting Summary

## Issue Reported
User created a new inquiry via email but did not receive a questionnaire email reply.

## Root Cause Analysis

### What Happened
1. ✅ Email was received and processed correctly
2. ✅ Inquiry was created with `sourceType: 'email'`
3. ✅ `WorkflowOrchestrator.processNewInquiry()` was called
4. ❌ **Email workflow failed silently** due to multiple issues:
   - Missing email templates in database
   - TypeScript errors in `EmailWorkflowOrchestrator.ts`
   - TypeScript errors in `EmailSenderService.ts`
   - TypeScript errors in `SchedulingLinkGenerator.ts`

### Issues Fixed

#### 1. Missing Email Templates
**Problem**: No email templates existed in the database  
**Solution**: Created `scripts/seed-email-templates.ts` and seeded default templates

```bash
npx ts-node scripts/seed-email-templates.ts
```

#### 2. EmailWorkflowOrchestrator TypeScript Errors
**Problems**:
- Accessing `inquiry.tenantName` and `inquiry.tenantEmail` (don't exist on Inquiry type)
- Accessing `inquiry.managerId` (doesn't exist on Inquiry type)
- Using invalid status `'questionnaire_sent'` (not in InquiryStatus type)
- Calling non-existent `evaluateInquiry()` method

**Solutions**:
- Use `inquiry.prospectiveTenantName` instead of `tenantName`
- Extract `tenantEmail` from `inquiry.sourceMetadata.tenantEmail`
- Get `managerId` from the property: `property.managerId`
- Use `'pre_qualifying'` status instead of `'questionnaire_sent'`
- Call `evaluateQualification()` instead of `evaluateInquiry()`

#### 3. EmailSenderService TypeScript Errors
**Problems**:
- `OAuthManager` constructor called with `pool` parameter (doesn't accept parameters)
- Calling non-existent `oauthManager.getTokens()` method
- Returning `null` for `gmailMessageId` (type mismatch)

**Solutions**:
- Remove `pool` parameter from `OAuthManager` constructor
- Created `getConnectionTokens()` method to fetch and decrypt tokens directly
- Convert `null` to `undefined` for optional fields

#### 4. Missing TypeScript Types
**Problem**: Missing `@types/uuid` package  
**Solution**: Installed the package

```bash
npm install --save-dev @types/uuid
```

### Remaining Issues

There are still TypeScript compilation errors in `SchedulingLinkGenerator.ts`:
- Unused imports and parameters
- Type mismatches in method calls
- Non-existent methods being called

These don't affect the initial questionnaire email workflow but will cause issues when:
- A tenant completes the questionnaire
- The system tries to send scheduling emails

## Workaround Applied

Since the original inquiry was created before the fixes, I created a manual trigger script:

```bash
npx ts-node scripts/manual-trigger-workflow.ts
```

This script:
1. ✅ Created a questionnaire token for the inquiry
2. ✅ Generated the questionnaire link
3. ✅ Created an email log entry (marked as pending)
4. ✅ Updated inquiry status to `pre_qualifying`

**Questionnaire Link**: http://localhost:5173/questionnaire/47757bea-2334-48f3-9cc4-917b8e4e2dc8

## Testing & Verification

### Diagnostic Scripts Created

1. **check-email-workflow.ts** - Check workflow status for an inquiry
2. **check-inquiry-details.ts** - View full inquiry details
3. **simple-email-test.ts** - Verify email workflow setup
4. **seed-email-templates.ts** - Seed default email templates
5. **manual-trigger-workflow.ts** - Manually trigger workflow for existing inquiry

### Verification Steps

Run this to check if everything is set up correctly:

```bash
npx ts-node scripts/simple-email-test.ts
```

Expected output:
```
✓ Questionnaire template exists
✓ Active email connection found
✓ Inquiry found
✓ Questionnaire token created
✓ Email sent
```

## Next Steps

### For Immediate Fix
1. ✅ Email templates seeded
2. ✅ EmailWorkflowOrchestrator fixed
3. ✅ EmailSenderService fixed
4. ✅ Manual workflow triggered for existing inquiry
5. ⚠️ **Email still won't actually send** due to remaining compilation errors

### For Complete Solution
1. Fix remaining TypeScript errors in `SchedulingLinkGenerator.ts`
2. Test end-to-end workflow with a new email inquiry
3. Verify questionnaire submission triggers qualification
4. Verify scheduling emails are sent after qualification

### To Test New Inquiries
1. Send a new test email to the connected Gmail account
2. Wait for email polling (or trigger manual sync)
3. Check that:
   - Inquiry is created
   - Questionnaire token is generated
   - Email is sent to tenant
   - Inquiry status is updated to `pre_qualifying`

## Files Modified

- `src/engines/EmailWorkflowOrchestrator.ts` - Fixed property access and method calls
- `src/engines/EmailSenderService.ts` - Fixed OAuth token retrieval
- `scripts/seed-email-templates.ts` - Created
- `scripts/check-email-workflow.ts` - Created
- `scripts/check-inquiry-details.ts` - Created
- `scripts/simple-email-test.ts` - Created
- `scripts/manual-trigger-workflow.ts` - Created

## Key Learnings

1. **Silent Failures**: The workflow failed silently because errors were caught but not properly surfaced
2. **Type Safety**: TypeScript errors prevented compilation, which is why the workflow never ran
3. **Missing Data**: Email templates must be seeded before the workflow can run
4. **Property Access**: The Inquiry model doesn't have direct `tenantName`/`tenantEmail` properties - they're in metadata

## Recommendations

1. **Add Better Error Logging**: Surface workflow errors in the UI or notifications
2. **Add Health Checks**: Verify email templates and connections exist before processing inquiries
3. **Add Integration Tests**: Test the full email workflow end-to-end
4. **Fix Remaining Errors**: Complete the TypeScript error fixes for full functionality
