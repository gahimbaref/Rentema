import { useState, useEffect } from 'react';
import { platformsApi, PlatformConnection } from '../api';
import PlatformForm from '../components/PlatformForm';
import PageHeader from '../components/PageHeader';
import './PlatformsPage.css';

const PlatformsPage = () => {
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const response = await platformsApi.list();
      setPlatforms(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load platforms');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      setVerifying(id);
      const response = await platformsApi.verify(id);
      if (response.data.verified) {
        alert('Connection verified successfully!');
      } else {
        alert('Connection verification failed');
      }
      await loadPlatforms();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to verify connection');
    } finally {
      setVerifying(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this platform?')) return;
    
    try {
      await platformsApi.disconnect(id);
      await loadPlatforms();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disconnect platform');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    loadPlatforms();
  };

  const getPlatformIcon = (type: string) => {
    const icons: Record<string, string> = {
      zillow: '🏠',
      turbotenant: '🏢',
      facebook: '📘',
      test: '🧪',
    };
    return icons[type] || '🔌';
  };

  const getPlatformName = (type: string) => {
    const names: Record<string, string> = {
      zillow: 'Zillow',
      turbotenant: 'TurboTenant',
      facebook: 'Facebook Marketplace',
      test: 'Test Platform',
    };
    return names[type] || type;
  };

  if (loading) return <div className="loading">Loading platforms...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="platforms-page">
      <PageHeader 
        title="Platform Connections" 
        description="Connect and manage your rental listing platforms"
      >
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          🔌 Connect Platform
        </button>
      </PageHeader>

      {showForm && <PlatformForm onClose={handleFormClose} />}

      {platforms.length === 0 ? (
        <div className="empty-state">
          <p>No platform connections yet. Connect a platform to start receiving inquiries.</p>
        </div>
      ) : (
        <div className="platforms-grid">
          {platforms.map((platform) => (
            <div key={platform.id} className="platform-card">
              <div className="platform-header">
                <div className="platform-title">
                  <span className="platform-icon">{getPlatformIcon(platform.platformType)}</span>
                  <h3>{getPlatformName(platform.platformType)}</h3>
                </div>
                <span className={`status-badge ${platform.isActive ? 'active' : 'inactive'}`}>
                  {platform.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="platform-details">
                <p><strong>Platform ID:</strong> {platform.id}</p>
                <p><strong>Last Verified:</strong> {new Date(platform.lastVerified).toLocaleString()}</p>
                <p><strong>Connected:</strong> {new Date(platform.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="platform-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleVerify(platform.id)}
                  disabled={verifying === platform.id}
                >
                  {verifying === platform.id ? 'Verifying...' : 'Verify Connection'}
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDisconnect(platform.id)}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="info-section">
        <h2>About Platform Connections</h2>
        <p>
          Connect your rental listing platforms to automatically receive and respond to inquiries.
          Each platform requires specific credentials to establish a connection.
        </p>
        <ul>
          <li><strong>Zillow:</strong> Requires API key from Zillow Partner Network</li>
          <li><strong>TurboTenant:</strong> Requires API credentials from your TurboTenant account</li>
          <li><strong>Facebook Marketplace:</strong> Requires Facebook App credentials</li>
          <li><strong>Test Platform:</strong> For testing without real platform connections</li>
        </ul>
      </div>
    </div>
  );
};

export default PlatformsPage;
