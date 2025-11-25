import { useState, useEffect } from 'react';
import { templatesApi, MessageTemplate } from '../api';
import './TemplatesPage.css';

const TEMPLATE_TYPES = [
  { value: 'pre_qualification_start', label: 'Pre-Qualification Start' },
  { value: 'pre_qualification_question', label: 'Pre-Qualification Question' },
  { value: 'qualification_success', label: 'Qualification Success' },
  { value: 'qualification_failure', label: 'Qualification Failure' },
  { value: 'video_call_offer', label: 'Video Call Offer' },
  { value: 'video_call_confirmation', label: 'Video Call Confirmation' },
  { value: 'tour_confirmation', label: 'Tour Confirmation' },
  { value: 'reminder_24h', label: '24 Hour Reminder' },
  { value: 'reminder_2h', label: '2 Hour Reminder' },
];

const TemplatesPage = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedType, setSelectedType] = useState(TEMPLATE_TYPES[0].value);
  const [currentTemplate, setCurrentTemplate] = useState<MessageTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadTemplate(selectedType);
    }
  }, [selectedType]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templatesApi.list();
      setTemplates(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async (type: string) => {
    try {
      const response = await templatesApi.get(type);
      setCurrentTemplate(response.data);
      setEditedContent(response.data.content);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load template');
    }
  };

  const handleSave = async () => {
    if (!currentTemplate) return;

    setSaving(true);
    setError(null);

    try {
      await templatesApi.update(currentTemplate.type, editedContent);
      await loadTemplate(currentTemplate.type);
      alert('Template saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentTemplate) return;
    if (!confirm('Reset this template to default? This cannot be undone.')) return;

    try {
      await templatesApi.reset(currentTemplate.type);
      await loadTemplate(currentTemplate.type);
      alert('Template reset to default');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset template');
    }
  };

  const insertVariable = (variable: string) => {
    setEditedContent(prev => prev + `{{${variable}}}`);
  };

  if (loading) return <div className="loading">Loading templates...</div>;
  if (error && !currentTemplate) return <div className="error">{error}</div>;

  return (
    <div className="templates-page">
      <div className="page-header">
        <h1>Message Templates</h1>
      </div>

      <div className="templates-layout">
        <div className="template-list">
          <h2>Template Types</h2>
          {TEMPLATE_TYPES.map((type) => (
            <button
              key={type.value}
              className={`template-item ${selectedType === type.value ? 'active' : ''}`}
              onClick={() => setSelectedType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="template-editor">
          {currentTemplate && (
            <>
              <div className="editor-header">
                <h2>{TEMPLATE_TYPES.find(t => t.value === currentTemplate.type)?.label}</h2>
                <div className="header-actions">
                  <button className="btn btn-secondary" onClick={handleReset}>
                    Reset to Default
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="editor-content">
                <div className="variables-section">
                  <h3>Available Variables</h3>
                  <p className="variables-hint">Click to insert into template</p>
                  <div className="variables-list">
                    {currentTemplate.requiredVariables.map((variable) => (
                      <button
                        key={variable}
                        className="variable-btn"
                        onClick={() => insertVariable(variable)}
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="editor-section">
                  <label>Template Content</label>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={12}
                    placeholder="Enter your template content..."
                  />
                </div>

                <div className="preview-section">
                  <h3>Preview</h3>
                  <div className="preview-box">
                    {editedContent || <span className="preview-empty">Template preview will appear here</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesPage;
