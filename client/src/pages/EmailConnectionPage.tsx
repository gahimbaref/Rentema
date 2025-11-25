import { useState, useEffect } from 'react';
import { emailApi, EmailConnectionStatus } from '../api';
import EmailFiltersForm from '../components/EmailFiltersForm';
import EmailStatsCard from '../components/EmailStatsCard';
import ManualSyncButton from '../components/ManualSyncButton';
import TestEmailParser from '../components/TestEmailParser';
import './EmailConnectionPage.css';

const EmailConnectionPage = () => {
  const [status, setStatus] = useState<EmailConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const email = urlParams.get('email');
    const callbackError = urlParams.get('error');

    if (success === 'true' && email) {
      setSuccessMessage(`Successfully connected Gmail account: ${email}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === 'false' && callbackError) {
      setError(`Failed to connect Gmail: ${callbackError}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await emailApi.status();
      setStatus(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load email connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const response = await emailApi.connect();
      
      // Redirect to Google OAuth authorization URL
      window.location.href = response.data.authorizationUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate email connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account? This will stop automatic email monitoring.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);
      await emailApi.disconnect();
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disconnect email');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncComplete = async () => {
    await loadStatus();
  };

  const formatLastSync = (lastPollTime?: string) => {
    if (!lastPollTime) return 'Never';
    
    const date = new Date(lastPollTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading email connection status...</div>;
  }

  return (
    <div className="email-connection-page">
      <div className="page-header">
        <h1>Email Integration</h1>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-banner">
          {successMessage}
        </div>
      )}

      <div className="connection-card">
        <div className="connection-header">
          <div className="connection-title">
            <span className="connection-icon">📧</span>
            <h2>Gmail Connection</h2>
          </div>
          <span className={`status-badge ${status?.connected ? 'connected' : 'disconnected'}`}>
            {status?.connected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        <div className="connection-content">
          {status?.connected ? (
            <>
              <div className="connection-details">
                <div className="detail-row">
                  <span className="detail-label">Email Address:</span>
                  <span className="detail-value">{status.emailAddress}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Sync:</span>
                  <span className="detail-value">{formatLastSync(status.lastPollTime)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Connected Since:</span>
                  <span className="detail-value">
                    {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="connection-actions">
                <ManualSyncButton
                  onSync={async () => {
                    const response = await emailApi.sync();
                    return response.data;
                  }}
                  onComplete={handleSyncComplete}
                />
                <button 
                  className="btn btn-danger" 
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="connection-empty">
                <p>Connect your Gmail account to automatically capture rental inquiries from email notifications.</p>
                <p>Rentema will monitor your inbox for inquiry emails from platforms like Facebook Marketplace, Zillow, Craigslist, and more.</p>
              </div>

              <div className="connection-actions">
                <button 
                  className="btn btn-primary btn-large" 
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? 'Connecting...' : 'Connect Gmail'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {status?.connected && (
        <>
          <div className="stats-section">
            <EmailStatsCard
              onLoad={async () => {
                const response = await emailApi.getStats();
                return response.data;
              }}
            />
          </div>

          <div className="filters-section">
            <EmailFiltersForm
              onLoad={async () => {
                const response = await emailApi.getFilters();
                return response.data;
              }}
              onSave={async (filters) => {
                await emailApi.updateFilters(filters);
              }}
            />
          </div>
        </>
      )}

      <div className="test-parser-section">
        <TestEmailParser
          onParse={async (data) => {
            const response = await emailApi.testParse(data);
            return response.data;
          }}
        />
      </div>

      <div className="info-section">
        <h2>About Email Integration</h2>
        <p>
          Email integration allows Rentema to automatically capture rental inquiries from platforms 
          that send email notifications. This works alongside direct platform connections to ensure 
          you never miss an inquiry.
        </p>
        
        <h3>How it works:</h3>
        <ul>
          <li><strong>Automatic Monitoring:</strong> Rentema checks your email every 5 minutes for new inquiry notifications</li>
          <li><strong>Smart Detection:</strong> Identifies inquiry emails from Facebook Marketplace, Zillow, Craigslist, TurboTenant, and more</li>
          <li><strong>Data Extraction:</strong> Automatically extracts tenant information and inquiry details</li>
          <li><strong>Property Matching:</strong> Links inquiries to your properties and triggers automated workflows</li>
          <li><strong>Secure Access:</strong> Uses OAuth 2.0 for secure, read-only access to your Gmail account</li>
        </ul>

        <h3>Privacy & Security:</h3>
        <ul>
          <li>Rentema only reads emails - it cannot send emails or access other Google services</li>
          <li>Your credentials are encrypted and stored securely</li>
          <li>You can disconnect at any time to revoke access</li>
          <li>Only inquiry-related emails are processed; other emails are ignored</li>
        </ul>
      </div>
    </div>
  );
};

export default EmailConnectionPage;
