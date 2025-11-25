import { useState, useEffect } from 'react';
import './EmailFiltersForm.css';

interface EmailFilters {
  senderWhitelist: string[];
  subjectKeywords: string[];
  excludeSenders: string[];
  excludeSubjectKeywords: string[];
}

interface EmailFiltersFormProps {
  onSave: (filters: EmailFilters) => Promise<void>;
  onLoad: () => Promise<EmailFilters>;
}

const EmailFiltersForm = ({ onSave, onLoad }: EmailFiltersFormProps) => {
  const [filters, setFilters] = useState<EmailFilters>({
    senderWhitelist: [],
    subjectKeywords: [],
    excludeSenders: [],
    excludeSubjectKeywords: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Input states for adding new items
  const [newSender, setNewSender] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcludeSender, setNewExcludeSender] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      setLoading(true);
      const loadedFilters = await onLoad();
      setFilters(loadedFilters);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load filters');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await onSave(filters);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save filters');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field: keyof EmailFilters, value: string, clearInput: () => void) => {
    if (!value.trim()) return;
    
    const currentList = filters[field] as string[];
    if (!currentList.includes(value.trim())) {
      setFilters({
        ...filters,
        [field]: [...currentList, value.trim()]
      });
    }
    clearInput();
  };

  const removeItem = (field: keyof EmailFilters, index: number) => {
    const currentList = filters[field] as string[];
    setFilters({
      ...filters,
      [field]: currentList.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return <div className="loading">Loading filters...</div>;
  }

  return (
    <div className="email-filters-form">
      <div className="form-header">
        <h2>Email Filters</h2>
        <p>Configure which emails Rentema should monitor and process</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {success && (
        <div className="success-banner">
          Filters saved successfully!
        </div>
      )}

      <div className="filter-section">
        <h3>Sender Whitelist</h3>
        <p className="section-description">
          Only process emails from these senders (leave empty to process all)
        </p>
        
        <div className="input-group">
          <input
            type="email"
            placeholder="e.g., noreply@facebookmail.com"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('senderWhitelist', newSender, () => setNewSender(''));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addItem('senderWhitelist', newSender, () => setNewSender(''))}
          >
            Add
          </button>
        </div>

        <div className="items-list">
          {filters.senderWhitelist.map((sender, index) => (
            <div key={index} className="list-item">
              <span>{sender}</span>
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeItem('senderWhitelist', index)}
              >
                ×
              </button>
            </div>
          ))}
          {filters.senderWhitelist.length === 0 && (
            <div className="empty-state">No senders added (all senders allowed)</div>
          )}
        </div>
      </div>

      <div className="filter-section">
        <h3>Subject Keywords</h3>
        <p className="section-description">
          Only process emails with these keywords in the subject line
        </p>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="e.g., inquiry, rental, interested"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('subjectKeywords', newKeyword, () => setNewKeyword(''));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addItem('subjectKeywords', newKeyword, () => setNewKeyword(''))}
          >
            Add
          </button>
        </div>

        <div className="items-list">
          {filters.subjectKeywords.map((keyword, index) => (
            <div key={index} className="list-item">
              <span>{keyword}</span>
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeItem('subjectKeywords', index)}
              >
                ×
              </button>
            </div>
          ))}
          {filters.subjectKeywords.length === 0 && (
            <div className="empty-state">No keywords added (all subjects allowed)</div>
          )}
        </div>
      </div>

      <div className="filter-section">
        <h3>Exclude Senders</h3>
        <p className="section-description">
          Never process emails from these senders
        </p>
        
        <div className="input-group">
          <input
            type="email"
            placeholder="e.g., spam@example.com"
            value={newExcludeSender}
            onChange={(e) => setNewExcludeSender(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('excludeSenders', newExcludeSender, () => setNewExcludeSender(''));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addItem('excludeSenders', newExcludeSender, () => setNewExcludeSender(''))}
          >
            Add
          </button>
        </div>

        <div className="items-list">
          {filters.excludeSenders.map((sender, index) => (
            <div key={index} className="list-item">
              <span>{sender}</span>
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeItem('excludeSenders', index)}
              >
                ×
              </button>
            </div>
          ))}
          {filters.excludeSenders.length === 0 && (
            <div className="empty-state">No senders excluded</div>
          )}
        </div>
      </div>

      <div className="filter-section">
        <h3>Exclude Subject Keywords</h3>
        <p className="section-description">
          Never process emails with these keywords in the subject line
        </p>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="e.g., unsubscribe, newsletter"
            value={newExcludeKeyword}
            onChange={(e) => setNewExcludeKeyword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem('excludeSubjectKeywords', newExcludeKeyword, () => setNewExcludeKeyword(''));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addItem('excludeSubjectKeywords', newExcludeKeyword, () => setNewExcludeKeyword(''))}
          >
            Add
          </button>
        </div>

        <div className="items-list">
          {filters.excludeSubjectKeywords.map((keyword, index) => (
            <div key={index} className="list-item">
              <span>{keyword}</span>
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeItem('excludeSubjectKeywords', index)}
              >
                ×
              </button>
            </div>
          ))}
          {filters.excludeSubjectKeywords.length === 0 && (
            <div className="empty-state">No keywords excluded</div>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Filters'}
        </button>
      </div>
    </div>
  );
};

export default EmailFiltersForm;
