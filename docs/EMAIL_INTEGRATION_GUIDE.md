# Email Integration User Guide

## Overview

Rentema's Email Integration feature automatically captures rental inquiries from your Gmail account. When listing platforms like Facebook Marketplace, Zillow, Craigslist, or TurboTenant send you inquiry notifications via email, Rentema can automatically:

- Detect and identify the platform
- Extract tenant information and inquiry details
- Match inquiries to your properties
- Create inquiries in your dashboard
- Trigger automated pre-qualification workflows

This guide will walk you through connecting your Gmail account, configuring filters, using test mode, and interpreting statistics.

---

## Table of Contents

1. [Connecting Your Gmail Account](#connecting-your-gmail-account)
2. [Configuring Email Filters](#configuring-email-filters)
3. [Using Test Mode](#using-test-mode)
4. [Interpreting Statistics](#interpreting-statistics)
5. [Manual Sync](#manual-sync)
6. [Troubleshooting](#troubleshooting)
7. [Security & Privacy](#security--privacy)

---

## Connecting Your Gmail Account

### Prerequisites

Before connecting your Gmail account, ensure that:
- Your administrator has configured Google OAuth credentials (see README.md)
- You have a Gmail account with rental inquiry emails
- You're logged into Rentema

### Connection Steps

1. **Navigate to Email Connection Page**
   - From the main dashboard, click on "Email Integration" or "Settings"
   - Select "Email Connection"

2. **Initiate Connection**
   - Click the "Connect Gmail" button
   - You'll be redirected to Google's authorization page

3. **Authorize Rentema**
   - Sign in to your Gmail account if prompted
   - Review the permissions Rentema is requesting:
     - Read your email messages
     - Modify email messages (to mark as read)
   - Click "Allow" to grant access

4. **Confirmation**
   - You'll be redirected back to Rentema
   - Your connected email address will be displayed
   - The connection status will show as "Active"

### What Happens After Connection?

Once connected, Rentema will:
- Poll your Gmail account every 5 minutes for new inquiry emails
- Only check unread messages from the last 7 days
- Mark processed emails as read to prevent duplicates
- Create inquiries automatically based on extracted information

---

## Configuring Email Filters

Email filters help Rentema focus on relevant inquiry emails and ignore unrelated messages.

### Accessing Filter Configuration

1. Navigate to the Email Connection page
2. Scroll to the "Email Filters" section
3. Click "Configure Filters"

### Filter Types

#### 1. Sender Whitelist

Specify email addresses or domains that should be processed.

**Examples:**
- `facebookmail.com` - All emails from Facebook
- `notify@zillow.com` - Specific Zillow notification address
- `craigslist.org` - All Craigslist emails

**How to Configure:**
- Enter one sender pattern per line
- Use domain names (e.g., `zillow.com`) to match all emails from that domain
- Use full email addresses for specific senders

#### 2. Subject Keywords

Specify keywords that should appear in the subject line.

**Examples:**
- `inquiry`
- `interested in your listing`
- `rental application`
- `property question`

**How to Configure:**
- Enter one keyword per line
- Keywords are case-insensitive
- Emails matching ANY keyword will be processed

#### 3. Exclude Senders

Specify senders that should be ignored, even if they match other filters.

**Examples:**
- `noreply@example.com`
- `marketing@platform.com`
- `newsletter@zillow.com`

#### 4. Exclude Subject Keywords

Specify subject keywords that should cause emails to be skipped.

**Examples:**
- `unsubscribe`
- `newsletter`
- `promotional`
- `account update`

### Default Filters

Rentema provides default filters for common rental platforms:

**Default Sender Whitelist:**
- `facebookmail.com`
- `zillow.com`
- `craigslist.org`
- `turbotenant.com`

**Default Subject Keywords:**
- `inquiry`
- `interested`
- `rental`
- `property`

### Saving and Testing Filters

1. After configuring filters, click "Save Filters"
2. New filters apply to subsequent email polling (not retroactively)
3. Use Test Mode (see below) to verify your filters work correctly

---

## Using Test Mode

Test Mode allows you to verify email parsing without connecting your Gmail account or creating actual inquiries.

### Accessing Test Mode

1. Navigate to the Email Connection page
2. Click on the "Test Email Parser" tab or section
3. You'll see a text area for pasting email content

### Testing with Sample Emails

Rentema provides sample emails for each supported platform:

1. **Select a Platform**
   - Click on one of the sample email buttons:
     - Facebook Marketplace
     - Zillow
     - Craigslist
     - TurboTenant

2. **Review Sample Email**
   - The sample email content will populate in the text area
   - You can modify the content to test different scenarios

3. **Parse the Email**
   - Click "Test Parse"
   - Rentema will analyze the email and display results

### Understanding Test Results

The test results show:

#### Extracted Fields
- **Tenant Name**: The prospective tenant's name
- **Tenant Email**: Contact email address (if found)
- **Tenant Phone**: Contact phone number (if found)
- **Message**: The inquiry message content
- **Property Reference**: Property address or listing ID
- **Platform**: Identified platform (Facebook, Zillow, etc.)

#### Parsing Status
- **✓ Success**: Field was successfully extracted
- **⚠ Warning**: Field was partially extracted or has low confidence
- **✗ Missing**: Required field could not be extracted

#### Parsing Errors
Any errors or warnings encountered during parsing will be displayed, such as:
- "Could not extract tenant name"
- "Property reference not found"
- "Unknown email format"

### Testing Your Own Emails

1. **Copy an Inquiry Email**
   - Open an inquiry email in your Gmail
   - Copy the entire email content (including headers if possible)

2. **Paste into Test Mode**
   - Paste the content into the text area
   - Click "Test Parse"

3. **Review Results**
   - Check which fields were extracted successfully
   - Note any parsing errors
   - If extraction fails, the email format may not be supported yet

### Test Mode Best Practices

- Test emails from each platform you use
- Test with various email formats (HTML, plain text)
- Verify property address extraction matches your property listings
- Test edge cases (missing information, unusual formats)
- **Remember**: Test mode does NOT create actual inquiries

---

## Interpreting Statistics

The Email Integration dashboard provides statistics to help you understand how well the integration is working.

### Accessing Statistics

1. Navigate to the Email Connection page
2. View the "Email Statistics" card or section
3. Statistics update after each polling cycle

### Key Metrics

#### 1. Total Emails Processed

**What it means**: The total number of inquiry emails Rentema has processed since connection.

**What to look for**:
- Steady growth indicates active email monitoring
- No growth may indicate:
  - No new inquiry emails received
  - Filters are too restrictive
  - Connection issues

#### 2. Successful Extractions

**What it means**: Number of emails where Rentema successfully extracted inquiry information and created an inquiry.

**What to look for**:
- High success rate (>80%) is ideal
- Low success rate may indicate:
  - Unsupported email formats
  - Filters capturing non-inquiry emails
  - Platform email format changes

#### 3. Failed Parsing

**What it means**: Number of emails where Rentema couldn't extract required information.

**What to look for**:
- Occasional failures are normal (5-10%)
- High failure rate (>20%) may indicate:
  - New platform email formats
  - Incorrect filter configuration
  - Non-inquiry emails being processed

**Action**: Review failed emails in the inquiry list (flagged for manual review)

#### 4. Last Sync Time

**What it means**: The timestamp of the most recent email polling operation.

**What to look for**:
- Should update every 5 minutes
- Stale timestamp (>10 minutes old) may indicate:
  - Polling service stopped
  - Connection expired
  - System error

**Action**: Try manual sync or reconnect Gmail

#### 5. Platform Breakdown

**What it means**: A chart showing the distribution of inquiries by platform (Facebook, Zillow, Craigslist, etc.).

**What to look for**:
- Reflects your active listing platforms
- Helps identify which platforms generate most inquiries
- Missing platforms may indicate:
  - No inquiries from that platform
  - Platform not configured in filters
  - Platform emails not being recognized

### Statistics Time Ranges

You can view statistics for different time periods:
- **Last 24 Hours**: Recent activity
- **Last 7 Days**: Weekly trends
- **Last 30 Days**: Monthly overview
- **All Time**: Complete history

### Exporting Statistics

Click "Export Statistics" to download a CSV file with detailed metrics for analysis.

---

## Manual Sync

Manual sync allows you to immediately check for new inquiry emails without waiting for the automatic 5-minute polling cycle.

### When to Use Manual Sync

- You just received an inquiry email and want immediate processing
- Testing after changing filter configuration
- Troubleshooting connection issues
- After reconnecting your Gmail account

### How to Perform Manual Sync

1. Navigate to the Email Connection page
2. Click the "Sync Now" button
3. Wait for the sync to complete (usually 5-30 seconds)

### Sync Results

After sync completes, you'll see:
- **Emails Found**: Number of new unread inquiry emails
- **Inquiries Created**: Number of inquiries successfully created
- **Errors**: Any errors encountered during sync

### Sync Status Indicators

- **🔄 Syncing**: Sync in progress
- **✓ Success**: Sync completed successfully
- **✗ Failed**: Sync encountered errors

### Troubleshooting Sync Issues

**"No new emails found"**
- Check your Gmail inbox for unread inquiry emails
- Verify emails match your filter configuration
- Ensure emails are from the last 7 days

**"Authentication failed"**
- Your Gmail connection may have expired
- Click "Disconnect" then "Connect Gmail" to reconnect

**"Sync timeout"**
- Gmail API may be slow or unavailable
- Wait a few minutes and try again

---

## Troubleshooting

### Connection Issues

#### Problem: "Failed to connect Gmail"

**Possible causes**:
- OAuth credentials not configured correctly
- Google Cloud Console project not set up
- Gmail API not enabled

**Solutions**:
1. Verify OAuth credentials in `.env` file
2. Check Google Cloud Console configuration
3. Ensure Gmail API is enabled
4. Contact your administrator

#### Problem: "Connection expired" or "Token invalid"

**Possible causes**:
- OAuth token expired
- Token was revoked
- Credentials changed

**Solutions**:
1. Click "Disconnect"
2. Click "Connect Gmail" to reconnect
3. Re-authorize Rentema

### Parsing Issues

#### Problem: "Failed to extract tenant information"

**Possible causes**:
- Unsupported email format
- Platform changed email template
- Email is not an inquiry

**Solutions**:
1. Use Test Mode to analyze the email
2. Check if email matches expected platform format
3. Review parsing errors for specific issues
4. Contact support if format is unsupported

#### Problem: "Property not matched"

**Possible causes**:
- Property address in email doesn't match database
- Property not added to Rentema yet
- Address format differs

**Solutions**:
1. Add the property to Rentema first
2. Ensure property address matches email format
3. Manually assign inquiry to property from dashboard

### Filter Issues

#### Problem: "Too many emails being processed"

**Possible causes**:
- Filters too broad
- Non-inquiry emails matching filters

**Solutions**:
1. Add exclude keywords for common non-inquiry subjects
2. Narrow sender whitelist
3. Review processed emails to identify patterns

#### Problem: "Inquiry emails being skipped"

**Possible causes**:
- Filters too restrictive
- Sender not in whitelist
- Subject doesn't match keywords

**Solutions**:
1. Review filter configuration
2. Add missing senders to whitelist
3. Add relevant subject keywords
4. Check exclude filters aren't blocking inquiries

---

## Security & Privacy

### Data Security

- **OAuth Tokens**: Stored encrypted using AES-256 encryption
- **Email Content**: Only inquiry emails are stored; other emails are ignored
- **Credentials**: Never stored in plain text
- **Access**: Limited to read and modify (mark as read) permissions

### Privacy Considerations

- Rentema only accesses emails matching your configured filters
- Emails are marked as read after processing to prevent duplicates
- Original email content is stored only for inquiries with parsing errors
- You can disconnect at any time to revoke access

### Revoking Access

To completely revoke Rentema's access to your Gmail:

1. **In Rentema**:
   - Navigate to Email Connection page
   - Click "Disconnect"
   - Confirm disconnection

2. **In Google Account** (optional, for complete revocation):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Navigate to "Third-party apps with account access"
   - Find "Rentema" and click "Remove Access"

### Best Practices

- Use a dedicated Gmail account for rental inquiries
- Regularly review processed emails and statistics
- Keep OAuth credentials secure
- Use strong encryption keys
- Monitor for suspicious activity

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [README.md](../README.md) for setup instructions
3. Contact your system administrator
4. Submit a bug report with:
   - Error messages
   - Steps to reproduce
   - Sample email (with personal information removed)

---

## Appendix: Supported Platforms

### Facebook Marketplace
- **Sender**: `facebookmail.com`
- **Typical Subject**: "New message about your listing"
- **Extracted Fields**: Tenant name, message, property reference

### Zillow
- **Sender**: `zillow.com`
- **Typical Subject**: "New inquiry for [address]"
- **Extracted Fields**: Tenant name, email, phone, message, property address

### Craigslist
- **Sender**: `craigslist.org`
- **Typical Subject**: "Reply to your ad"
- **Extracted Fields**: Tenant email, message, property reference

### TurboTenant
- **Sender**: `turbotenant.com`
- **Typical Subject**: "New rental inquiry"
- **Extracted Fields**: Tenant name, email, phone, message, property address

---

*Last updated: 2024*
