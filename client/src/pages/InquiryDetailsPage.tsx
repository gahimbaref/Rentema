import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { inquiriesApi, Inquiry, Message } from '../api';
import './InquiryDetailsPage.css';

const InquiryDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (id) {
      loadInquiry(id);
      
      // Auto-refresh every 5 seconds to catch status updates
      const interval = setInterval(() => {
        loadInquiry(id);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadInquiry = async (inquiryId: string) => {
    try {
      setLoading(true);
      const response = await inquiriesApi.get(inquiryId);
      setInquiry(response.data.inquiry);
      setMessages(response.data.messages);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load inquiry');
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (action: string) => {
    if (!inquiry) return;

    const confirmMessage = action === 'qualify' 
      ? 'Manually qualify this inquiry?'
      : action === 'disqualify'
      ? 'Manually disqualify this inquiry?'
      : 'Cancel this appointment?';

    if (!confirm(confirmMessage)) return;

    try {
      await inquiriesApi.override(inquiry.id, { type: action });
      await loadInquiry(inquiry.id);
      alert('Action completed successfully');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to perform action');
    }
  };

  const handleAddNote = async () => {
    if (!inquiry || !noteText.trim()) return;

    try {
      setAddingNote(true);
      await inquiriesApi.addNote(inquiry.id, noteText);
      setNoteText('');
      await loadInquiry(inquiry.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      new: 'status-new',
      pre_qualifying: 'status-qualifying',
      qualified: 'status-qualified',
      disqualified: 'status-disqualified',
      video_call_scheduled: 'status-scheduled',
      tour_scheduled: 'status-scheduled',
      completed: 'status-completed',
    };
    return classes[status] || 'status-default';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) return <div className="loading">Loading inquiry...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!inquiry) return <div className="error">Inquiry not found</div>;

  return (
    <div className="inquiry-details-page">
      <div className="page-header">
        <div>
          <Link to="/inquiries" className="back-link">← Back to Inquiries</Link>
          <h1>{inquiry.prospectiveTenantName || 'Unknown Tenant'}</h1>
          <span className={`status-badge ${getStatusBadgeClass(inquiry.status)}`}>
            {getStatusLabel(inquiry.status)}
          </span>
        </div>
      </div>

      <div className="details-layout">
        <div className="main-column">
          <div className="section">
            <h2>Conversation History</h2>
            {messages.length === 0 ? (
              <p className="empty-message">No messages yet</p>
            ) : (
              <div className="messages-list">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.direction === 'outbound' ? 'outbound' : 'inbound'}`}
                  >
                    <div className="message-header">
                      <span className="message-direction">
                        {message.direction === 'outbound' ? 'System' : 'Tenant'}
                      </span>
                      <span className="message-time">
                        {new Date(message.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="message-content">{message.content}</div>
                    <div className="message-status">{message.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h2>Add Note</h2>
            <div className="note-form">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this inquiry..."
                rows={4}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>

        <div className="sidebar-column">
          <div className="section">
            <h2>Inquiry Details</h2>
            <div className="detail-row">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{inquiry.id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value">{getStatusLabel(inquiry.status)}</span>
            </div>
            {inquiry.sourceType && (
              <div className="detail-row">
                <span className="detail-label">Source:</span>
                <span className="detail-value">
                  {inquiry.sourceType === 'email' && (
                    <span className="source-badge email">
                      📧 Email
                    </span>
                  )}
                  {inquiry.sourceType === 'platform_api' && (
                    <span className="source-badge platform">
                      🔗 Platform API
                    </span>
                  )}
                  {inquiry.sourceType === 'manual' && (
                    <span className="source-badge manual">
                      ✍️ Manual
                    </span>
                  )}
                </span>
              </div>
            )}
            {inquiry.sourceType === 'email' && inquiry.sourceMetadata?.platformType && (
              <div className="detail-row">
                <span className="detail-label">Platform:</span>
                <span className="detail-value">
                  {inquiry.sourceMetadata.platformType.charAt(0).toUpperCase() + 
                   inquiry.sourceMetadata.platformType.slice(1)}
                </span>
              </div>
            )}
            {inquiry.sourceType === 'email' && inquiry.sourceMetadata?.receivedDate && (
              <div className="detail-row">
                <span className="detail-label">Email Received:</span>
                <span className="detail-value">
                  {new Date(inquiry.sourceMetadata.receivedDate).toLocaleString()}
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Created:</span>
              <span className="detail-value">
                {new Date(inquiry.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Updated:</span>
              <span className="detail-value">
                {new Date(inquiry.updatedAt).toLocaleString()}
              </span>
            </div>
            {inquiry.qualificationResult && (
              <div className="detail-row">
                <span className="detail-label">Qualified:</span>
                <span className="detail-value">
                  {inquiry.qualificationResult.qualified ? 'Yes' : 'No'}
                </span>
              </div>
            )}
          </div>

          {inquiry.sourceType === 'email' && inquiry.sourceMetadata?.parsingErrors && 
           inquiry.sourceMetadata.parsingErrors.length > 0 && (
            <div className="section">
              <h2>Parsing Errors</h2>
              <div className="parsing-errors">
                {inquiry.sourceMetadata.parsingErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {inquiry.sourceType === 'email' && inquiry.sourceMetadata?.originalEmail && 
           inquiry.sourceMetadata.parsingErrors && inquiry.sourceMetadata.parsingErrors.length > 0 && (
            <div className="section">
              <h2>Original Email</h2>
              <div className="original-email">
                <div className="email-field">
                  <span className="email-label">From:</span>
                  <span className="email-value">{inquiry.sourceMetadata.originalEmail.from}</span>
                </div>
                <div className="email-field">
                  <span className="email-label">Subject:</span>
                  <span className="email-value">{inquiry.sourceMetadata.originalEmail.subject}</span>
                </div>
                <div className="email-field">
                  <span className="email-label">Body:</span>
                  <pre className="email-body">{inquiry.sourceMetadata.originalEmail.body}</pre>
                </div>
              </div>
            </div>
          )}

          <div className="section">
            <h2>Manual Override</h2>
            <div className="override-actions">
              {inquiry.status === 'disqualified' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleOverride('qualify')}
                >
                  Manually Qualify
                </button>
              )}
              {(inquiry.status === 'qualified' || inquiry.status === 'pre_qualifying') && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleOverride('disqualify')}
                >
                  Manually Disqualify
                </button>
              )}
              {(inquiry.status === 'video_call_scheduled' || inquiry.status === 'tour_scheduled') && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleOverride('cancel_appointment')}
                >
                  Cancel Appointment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InquiryDetailsPage;
