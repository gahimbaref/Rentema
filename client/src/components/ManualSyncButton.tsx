import { useState } from 'react';
import './ManualSyncButton.css';

interface SyncResult {
  message: string;
  emailsProcessed: number;
  inquiriesCreated: number;
  inquiriesUnmatched: number;
  errors: any[];
}

interface ManualSyncButtonProps {
  onSync: () => Promise<SyncResult>;
  onComplete?: () => void;
}

const ManualSyncButton = ({ onSync, onComplete }: ManualSyncButtonProps) => {
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const syncResult = await onSync();
      setResult(syncResult);
      setShowModal(true);
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync emails');
      setShowModal(true);
    } finally {
      setSyncing(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <button
        className="manual-sync-button"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <>
            <span className="sync-spinner">⟳</span>
            Syncing...
          </>
        ) : (
          <>
            <span className="sync-icon">🔄</span>
            Sync Now
          </>
        )}
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{error ? 'Sync Failed' : 'Sync Complete'}</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {error ? (
                <div className="error-content">
                  <div className="error-icon">❌</div>
                  <p className="error-message">{error}</p>
                  <p className="error-help">
                    Please check your email connection and try again. If the problem persists,
                    you may need to reconnect your Gmail account.
                  </p>
                </div>
              ) : result ? (
                <div className="success-content">
                  <div className="success-icon">✅</div>
                  <p className="success-message">{result.message}</p>

                  <div className="sync-stats">
                    <div className="sync-stat">
                      <span className="stat-label">Emails Processed:</span>
                      <span className="stat-value">{result.emailsProcessed}</span>
                    </div>
                    <div className="sync-stat">
                      <span className="stat-label">Inquiries Created:</span>
                      <span className="stat-value success">{result.inquiriesCreated}</span>
                    </div>
                    <div className="sync-stat">
                      <span className="stat-label">Unmatched Inquiries:</span>
                      <span className="stat-value warning">{result.inquiriesUnmatched}</span>
                    </div>
                  </div>

                  {result.errors && result.errors.length > 0 && (
                    <div className="sync-errors">
                      <h4>Errors:</h4>
                      <ul>
                        {result.errors.map((err, index) => (
                          <li key={index}>{err.error || JSON.stringify(err)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.inquiriesUnmatched > 0 && (
                    <div className="sync-note">
                      <strong>Note:</strong> {result.inquiriesUnmatched} inquir{result.inquiriesUnmatched === 1 ? 'y' : 'ies'} could not be matched to a property.
                      You can manually assign {result.inquiriesUnmatched === 1 ? 'it' : 'them'} from the Inquiries page.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManualSyncButton;
