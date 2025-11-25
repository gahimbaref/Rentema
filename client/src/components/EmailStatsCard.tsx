import { useState, useEffect } from 'react';
import './EmailStatsCard.css';

interface EmailStats {
  totalEmailsProcessed: number;
  successfulExtractions: number;
  failedParsing: number;
  platformBreakdown: Record<string, number>;
  lastSyncTime?: string;
}

interface EmailStatsCardProps {
  onLoad: () => Promise<EmailStats>;
}

const EmailStatsCard = ({ onLoad }: EmailStatsCardProps) => {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const loadedStats = await onLoad();
      setStats(loadedStats);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (lastSyncTime?: string) => {
    if (!lastSyncTime) return 'Never';
    
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
  };

  const calculateSuccessRate = () => {
    if (!stats || stats.totalEmailsProcessed === 0) return 0;
    return Math.round((stats.successfulExtractions / stats.totalEmailsProcessed) * 100);
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      facebook: '📘',
      zillow: '🏠',
      craigslist: '📋',
      turbotenant: '🏢',
      unknown: '❓'
    };
    return icons[platform.toLowerCase()] || '📧';
  };

  if (loading) {
    return (
      <div className="email-stats-card">
        <div className="loading">Loading statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="email-stats-card">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="email-stats-card">
      <div className="stats-header">
        <h2>Email Processing Statistics</h2>
        <button className="btn-refresh" onClick={loadStats} title="Refresh statistics">
          🔄
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Total Processed</div>
            <div className="stat-value">{stats.totalEmailsProcessed}</div>
          </div>
        </div>

        <div className="stat-item success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Successful</div>
            <div className="stat-value">{stats.successfulExtractions}</div>
          </div>
        </div>

        <div className="stat-item failed">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-label">Failed</div>
            <div className="stat-value">{stats.failedParsing}</div>
          </div>
        </div>

        <div className="stat-item rate">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-label">Success Rate</div>
            <div className="stat-value">{calculateSuccessRate()}%</div>
          </div>
        </div>
      </div>

      <div className="last-sync">
        <span className="sync-label">Last Sync:</span>
        <span className="sync-value">{formatLastSync(stats.lastSyncTime)}</span>
      </div>

      {Object.keys(stats.platformBreakdown).length > 0 && (
        <div className="platform-breakdown">
          <h3>Platform Breakdown</h3>
          <div className="platform-list">
            {Object.entries(stats.platformBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <div key={platform} className="platform-item">
                  <div className="platform-info">
                    <span className="platform-icon">{getPlatformIcon(platform)}</span>
                    <span className="platform-name">
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </span>
                  </div>
                  <div className="platform-stats">
                    <span className="platform-count">{count}</span>
                    <div className="platform-bar">
                      <div
                        className="platform-bar-fill"
                        style={{
                          width: `${(count / stats.totalEmailsProcessed) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {Object.keys(stats.platformBreakdown).length === 0 && stats.totalEmailsProcessed === 0 && (
        <div className="empty-state">
          <p>No emails processed yet. Connect your Gmail account and sync to see statistics.</p>
        </div>
      )}
    </div>
  );
};

export default EmailStatsCard;
