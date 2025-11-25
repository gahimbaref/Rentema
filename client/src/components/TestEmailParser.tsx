import { useState } from 'react';
import './TestEmailParser.css';

interface ParseResult {
  platformType: string;
  success: boolean;
  extractedFields: Record<string, any>;
  missingFields: string[];
  errors: string[];
}

interface TestEmailParserProps {
  onParse: (data: {
    from: string;
    subject: string;
    body: string;
    platformType?: string;
  }) => Promise<ParseResult>;
}

// Sample emails for testing - these match the backend sample data
const SAMPLE_EMAILS = {
  facebook: {
    name: 'Facebook Marketplace',
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
(555) 123-4567`
  },
  zillow: {
    name: 'Zillow',
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
Manage your listings at zillow.com/rental-manager`
  },
  craigslist: {
    name: 'Craigslist',
    from: 'reply-abc123def456@craigslist.org',
    subject: 'Reply to: Beautiful 2BR apartment near downtown - 789 Pine Street',
    body: `Hi,

I saw your listing for the apartment at 789 Pine Street and I'm very interested in learning more.

A bit about me: I'm a graduate student at the local university with a part-time job. I have a guarantor (my parents) who can co-sign if needed. I'm quiet, responsible, and have never had any issues with previous landlords.

When would be a good time to see the place?

Thanks,
Bob Johnson
bob.j@email.com
Phone: 555-456-7890`
  },
  turbotenant: {
    name: 'TurboTenant',
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
Manage your properties at turbotenant.com`
  },
  facebookHtml: {
    name: 'Facebook (HTML)',
    from: 'notification@facebookmail.com',
    subject: 'Maria Garcia is interested in your listing',
    body: `<!DOCTYPE html>
<html>
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
  </div>
</body>
</html>`
  },
  zillowMinimal: {
    name: 'Zillow (Minimal)',
    from: 'noreply@zillow.com',
    subject: 'Inquiry about your rental listing',
    body: `New inquiry received!

Property: Rental listing on Zillow

From: Anonymous User
Email: privacy@zillow.com

Message:
Is this property still available? I'd like more information.

---
This inquiry was sent through Zillow's anonymous contact system.`
  }
};

const TestEmailParser = ({ onParse }: TestEmailParserProps) => {
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [platformType, setPlatformType] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!from.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in all fields (from, subject, and body)');
      return;
    }

    try {
      setParsing(true);
      setError(null);
      setResult(null);

      const parseResult = await onParse({
        from: from.trim(),
        subject: subject.trim(),
        body: body.trim(),
        platformType: platformType || undefined
      });

      setResult(parseResult);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse email');
    } finally {
      setParsing(false);
    }
  };

  const loadSample = (sampleKey: keyof typeof SAMPLE_EMAILS) => {
    const sample = SAMPLE_EMAILS[sampleKey];
    setFrom(sample.from);
    setSubject(sample.subject);
    setBody(sample.body);
    setPlatformType('');
    setResult(null);
    setError(null);
  };

  const clearForm = () => {
    setFrom('');
    setSubject('');
    setBody('');
    setPlatformType('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="test-email-parser">
      <div className="parser-header">
        <h2>Test Email Parser</h2>
        <p>Test email parsing without creating inquiries</p>
      </div>

      <div className="sample-emails">
        <h3>Sample Emails:</h3>
        <div className="sample-buttons">
          {Object.entries(SAMPLE_EMAILS).map(([key, sample]) => (
            <button
              key={key}
              className="btn btn-sample"
              onClick={() => loadSample(key as keyof typeof SAMPLE_EMAILS)}
            >
              {sample.name}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={clearForm}>
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="parser-form">
        <div className="form-group">
          <label htmlFor="from">From (Sender Email):</label>
          <input
            id="from"
            type="email"
            placeholder="e.g., notification@facebookmail.com"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject:</label>
          <input
            id="subject"
            type="text"
            placeholder="e.g., New inquiry for your listing"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="body">Email Body:</label>
          <textarea
            id="body"
            rows={10}
            placeholder="Paste the email content here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="platformType">Platform Type (Optional):</label>
          <select
            id="platformType"
            value={platformType}
            onChange={(e) => setPlatformType(e.target.value)}
          >
            <option value="">Auto-detect</option>
            <option value="facebook">Facebook Marketplace</option>
            <option value="zillow">Zillow</option>
            <option value="craigslist">Craigslist</option>
            <option value="turbotenant">TurboTenant</option>
          </select>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={handleParse}
            disabled={parsing}
          >
            {parsing ? 'Parsing...' : 'Parse Email'}
          </button>
        </div>
      </div>

      {result && (
        <div className="parse-results">
          <div className="results-header">
            <h3>Parse Results</h3>
            <span className={`result-badge ${result.success ? 'success' : 'failed'}`}>
              {result.success ? 'Success' : 'Failed'}
            </span>
          </div>

          <div className="result-section">
            <h4>Platform Detected:</h4>
            <div className="platform-badge">
              {result.platformType.charAt(0).toUpperCase() + result.platformType.slice(1)}
            </div>
          </div>

          {Object.keys(result.extractedFields).length > 0 && (
            <div className="result-section">
              <h4>Extracted Fields:</h4>
              <div className="extracted-fields">
                {Object.entries(result.extractedFields).map(([key, value]) => (
                  <div key={key} className="field-item">
                    <span className="field-label">{key}:</span>
                    <span className="field-value">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.missingFields.length > 0 && (
            <div className="result-section">
              <h4>Missing Fields:</h4>
              <div className="missing-fields">
                {result.missingFields.map((field, index) => (
                  <span key={index} className="missing-field-badge">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="result-section">
              <h4>Parsing Errors:</h4>
              <div className="parsing-errors">
                {result.errors.map((error, index) => (
                  <div key={index} className="error-item">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestEmailParser;
