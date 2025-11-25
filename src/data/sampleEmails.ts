/**
 * Sample Email Templates
 * These templates are used for testing email parsing functionality
 * without connecting to a real email account.
 */

export interface SampleEmail {
  name: string;
  platform: string;
  from: string;
  subject: string;
  body: string;
  description: string;
}

export const SAMPLE_EMAILS: Record<string, SampleEmail> = {
  facebook: {
    name: 'Facebook Marketplace',
    platform: 'facebook',
    from: 'notification@facebookmail.com',
    subject: 'John Doe sent you a message about your listing - 123 Main St Apartment',
    body: `Hi there,

I'm very interested in your rental property at 123 Main St.

I'm a working professional with stable income and excellent references. I'd love to schedule a viewing at your earliest convenience.

Could you please let me know about:
- Move-in date availability
- Pet policy
- Parking availability

Looking forward to hearing from you!

Best regards,
John Doe
john.doe@email.com
(555) 123-4567`,
    description: 'Typical Facebook Marketplace inquiry with tenant contact information'
  },

  zillow: {
    name: 'Zillow',
    platform: 'zillow',
    from: 'noreply@zillow.com',
    subject: 'New inquiry for 456 Oak Avenue - Zillow Rental Manager',
    body: `You have received a new rental inquiry through Zillow!

Property: 456 Oak Avenue, Apt 2B

From: Jane Smith
Email: jane.smith@email.com
Phone: (555) 987-6543

Message:
Hello, I'm very interested in this property. I have excellent credit (750+) and stable employment as a software engineer. I'm looking to move in by the end of next month. Can we schedule a tour this week? I'm available most afternoons.

Thank you for your time!

---
View this inquiry on Zillow
Manage your listings at zillow.com/rental-manager`,
    description: 'Zillow inquiry with structured contact information and detailed message'
  },

  craigslist: {
    name: 'Craigslist',
    platform: 'craigslist',
    from: 'reply-abc123def456@craigslist.org',
    subject: 'Reply to: Beautiful 2BR apartment near downtown - 789 Pine Street',
    body: `Hi,

I saw your listing for the apartment at 789 Pine Street and I'm very interested in learning more.

A bit about me: I'm a graduate student at the local university with a part-time job. I have a guarantor (my parents) who can co-sign if needed. I'm quiet, responsible, and have never had any issues with previous landlords.

When would be a good time to see the place?

Thanks,
Bob Johnson
bob.j@email.com
Phone: 555-456-7890`,
    description: 'Craigslist inquiry with anonymized sender and tenant details in body'
  },

  turbotenant: {
    name: 'TurboTenant',
    platform: 'turbotenant',
    from: 'notifications@turbotenant.com',
    subject: 'New Rental Inquiry - 321 Elm Drive',
    body: `You have received a new rental inquiry through TurboTenant!

Property: 321 Elm Drive, Unit 5

Applicant Information:
Name: Sarah Williams
Email: sarah.w@email.com
Phone: (555) 234-5678

Message:
I'm interested in renting this property starting next month. I have a stable job as a nurse at City Hospital and have been employed there for 3 years. I have good rental history and can provide references from my current landlord. Please let me know about the next steps in the application process.

---
Respond to this inquiry
View applicant details on TurboTenant
Manage your properties at turbotenant.com`,
    description: 'TurboTenant inquiry with structured applicant information'
  },

  facebookHtml: {
    name: 'Facebook Marketplace (HTML)',
    platform: 'facebook',
    from: 'notification@facebookmail.com',
    subject: 'Maria Garcia is interested in your listing',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .message { padding: 20px; }
  </style>
</head>
<body>
  <div class="message">
    <h2>New Message from Maria Garcia</h2>
    <p>About your listing: <strong>Cozy Studio Apartment - Downtown</strong></p>
    
    <div class="content">
      <p>Hi! I'm interested in your studio apartment. I'm a young professional working in tech and looking for a place close to downtown.</p>
      
      <p>Quick questions:</p>
      <ul>
        <li>Is it still available?</li>
        <li>What's included in utilities?</li>
        <li>Can I bring my small dog?</li>
      </ul>
      
      <p>You can reach me at:</p>
      <p>Email: maria.garcia@techcorp.com<br>
      Phone: (555) 321-9876</p>
      
      <p>Thanks!</p>
    </div>
    
    <div class="footer">
      <a href="https://facebook.com/marketplace">View on Facebook Marketplace</a>
    </div>
  </div>
</body>
</html>`,
    description: 'Facebook inquiry with HTML formatting (tests HTML stripping)'
  },

  zillowMinimal: {
    name: 'Zillow (Minimal Info)',
    platform: 'zillow',
    from: 'noreply@zillow.com',
    subject: 'Inquiry about your rental listing',
    body: `New inquiry received!

Property: Rental listing on Zillow

From: Anonymous User
Email: privacy@zillow.com

Message:
Is this property still available? I'd like more information.

---
This inquiry was sent through Zillow's anonymous contact system.`,
    description: 'Zillow inquiry with minimal information (tests graceful partial parsing)'
  },

  craigslistShort: {
    name: 'Craigslist (Brief)',
    platform: 'craigslist',
    from: 'reply-xyz789@craigslist.org',
    subject: 'Re: Apartment for rent',
    body: `Still available?

Thanks`,
    description: 'Very brief Craigslist inquiry (tests minimal message handling)'
  },

  turbotenantDetailed: {
    name: 'TurboTenant (Detailed)',
    platform: 'turbotenant',
    from: 'notifications@turbotenant.com',
    subject: 'New Application Inquiry - 555 Maple Court, Unit 12',
    body: `New Rental Application Inquiry

Property Details:
Address: 555 Maple Court, Unit 12
Rent: $1,500/month
Bedrooms: 2
Bathrooms: 1

Applicant Information:
Name: Michael Chen
Email: m.chen@email.com
Phone: (555) 876-5432
Current Address: 100 Oak Street, Apt 3

Message:
Hello! I'm currently renting but my lease is ending in two months. I'm a software developer at TechStart Inc. with a salary of $85,000/year. I have excellent credit (780) and no prior evictions. I'm a non-smoker with no pets. I can provide:
- Last 2 pay stubs
- Letter of employment
- Previous landlord references
- Bank statements

I'm very interested in this property and would love to schedule a viewing. I'm available weekdays after 5pm or anytime on weekends.

Thank you for considering my application!

Best regards,
Michael Chen

---
View full application on TurboTenant
Run background check
Schedule showing`,
    description: 'Detailed TurboTenant inquiry with comprehensive applicant information'
  }
};

/**
 * Get a sample email by key
 */
export function getSampleEmail(key: string): SampleEmail | undefined {
  return SAMPLE_EMAILS[key];
}

/**
 * Get all sample emails
 */
export function getAllSampleEmails(): SampleEmail[] {
  return Object.values(SAMPLE_EMAILS);
}

/**
 * Get sample emails by platform
 */
export function getSampleEmailsByPlatform(platform: string): SampleEmail[] {
  return Object.values(SAMPLE_EMAILS).filter(email => email.platform === platform);
}
