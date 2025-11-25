import { useState } from 'react';
import { platformsApi } from '../api';
import './PropertyForm.css';

interface PlatformFormProps {
  onClose: () => void;
}

const PlatformForm = ({ onClose }: PlatformFormProps) => {
  const [platformType, setPlatformType] = useState('test');
  const [credentials, setCredentials] = useState({
    apiKey: '',
    accessToken: '',
    refreshToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Filter out empty credentials
      const filteredCredentials: any = {};
      Object.entries(credentials).forEach(([key, value]) => {
        if (value.trim()) {
          filteredCredentials[key] = value;
        }
      });

      await platformsApi.connect({
        platformType,
        credentials: filteredCredentials,
      });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect platform');
    } finally {
      setLoading(false);
    }
  };

  const getCredentialFields = () => {
    switch (platformType) {
      case 'zillow':
        return (
          <div className="form-group">
            <label htmlFor="apiKey">Zillow API Key *</label>
            <input
              type="text"
              id="apiKey"
              name="apiKey"
              value={credentials.apiKey}
              onChange={handleCredentialChange}
              required
            />
          </div>
        );
      case 'turbotenant':
        return (
          <>
            <div className="form-group">
              <label htmlFor="apiKey">TurboTenant API Key *</label>
              <input
                type="text"
                id="apiKey"
                name="apiKey"
                value={credentials.apiKey}
                onChange={handleCredentialChange}
                required
              />
            </div>
          </>
        );
      case 'facebook':
        return (
          <>
            <div className="form-group">
              <label htmlFor="accessToken">Facebook Access Token *</label>
              <input
                type="text"
                id="accessToken"
                name="accessToken"
                value={credentials.accessToken}
                onChange={handleCredentialChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="refreshToken">Facebook Refresh Token</label>
              <input
                type="text"
                id="refreshToken"
                name="refreshToken"
                value={credentials.refreshToken}
                onChange={handleCredentialChange}
              />
            </div>
          </>
        );
      case 'test':
        return (
          <div className="form-group">
            <p style={{ color: '#7f8c8d', fontSize: '14px' }}>
              Test platform doesn't require credentials. It's used for testing the system without real platform connections.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Platform</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="platformType">Platform Type *</label>
            <select
              id="platformType"
              value={platformType}
              onChange={(e) => setPlatformType(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="test">Test Platform</option>
              <option value="zillow">Zillow</option>
              <option value="turbotenant">TurboTenant</option>
              <option value="facebook">Facebook Marketplace</option>
            </select>
          </div>

          {getCredentialFields()}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlatformForm;
