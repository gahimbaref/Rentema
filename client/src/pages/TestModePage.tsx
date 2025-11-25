import { useState, useEffect } from 'react';
import { testApi, propertiesApi, Property } from '../api';
import './TestModePage.css';

const TestModePage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test property form
  const [testPropertyForm, setTestPropertyForm] = useState({
    address: '',
    rentAmount: '',
    bedrooms: '',
    bathrooms: '',
    availabilityDate: '',
  });

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const response = await propertiesApi.list();
      const testProperties = response.data.filter(p => p.isTestMode && !p.isArchived);
      setProperties(testProperties);
      if (testProperties.length > 0) {
        setSelectedPropertyId(testProperties[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load properties:', err);
    }
  };

  const handleCreateTestProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = {
        address: testPropertyForm.address,
        rentAmount: parseFloat(testPropertyForm.rentAmount),
        bedrooms: parseInt(testPropertyForm.bedrooms),
        bathrooms: parseFloat(testPropertyForm.bathrooms),
        availabilityDate: new Date(testPropertyForm.availabilityDate).toISOString(),
        isTestMode: true,
      };

      await testApi.createTestProperty(data);
      setSuccess('Test property created successfully!');
      setTestPropertyForm({
        address: '',
        rentAmount: '',
        bedrooms: '',
        bathrooms: '',
        availabilityDate: '',
      });
      await loadProperties();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create test property');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId) {
      setError('Please select a property');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await testApi.simulateInquiry({
        propertyId: selectedPropertyId,
        message: inquiryMessage,
      });
      setSuccess('Inquiry simulated successfully! Check the Inquiries page to see it.');
      setInquiryMessage('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to simulate inquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="test-mode-page">
      <div className="page-header">
        <div>
          <h1>Test Mode</h1>
          <div className="test-mode-indicator">
            <span className="indicator-badge">🧪 Test Environment</span>
            <p>Create test properties and simulate inquiries without real platform connections</p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="test-sections">
        <div className="test-section">
          <div className="section-header">
            <h2>Create Test Property</h2>
            <p>Create a property in test mode to experiment with the system</p>
          </div>

          <form onSubmit={handleCreateTestProperty} className="test-form">
            <div className="form-group">
              <label htmlFor="address">Address *</label>
              <input
                type="text"
                id="address"
                value={testPropertyForm.address}
                onChange={(e) => setTestPropertyForm({ ...testPropertyForm, address: e.target.value })}
                placeholder="123 Test Street, Test City, TS 12345"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="rentAmount">Monthly Rent ($) *</label>
                <input
                  type="number"
                  id="rentAmount"
                  value={testPropertyForm.rentAmount}
                  onChange={(e) => setTestPropertyForm({ ...testPropertyForm, rentAmount: e.target.value })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="availabilityDate">Available Date *</label>
                <input
                  type="date"
                  id="availabilityDate"
                  value={testPropertyForm.availabilityDate}
                  onChange={(e) => setTestPropertyForm({ ...testPropertyForm, availabilityDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bedrooms">Bedrooms *</label>
                <input
                  type="number"
                  id="bedrooms"
                  value={testPropertyForm.bedrooms}
                  onChange={(e) => setTestPropertyForm({ ...testPropertyForm, bedrooms: e.target.value })}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bathrooms">Bathrooms *</label>
                <input
                  type="number"
                  id="bathrooms"
                  value={testPropertyForm.bathrooms}
                  onChange={(e) => setTestPropertyForm({ ...testPropertyForm, bathrooms: e.target.value })}
                  min="0"
                  step="0.5"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Test Property'}
            </button>
          </form>
        </div>

        <div className="test-section">
          <div className="section-header">
            <h2>Simulate Inquiry</h2>
            <p>Simulate a tenant inquiry to test the automated workflow</p>
          </div>

          {properties.length === 0 ? (
            <div className="empty-state">
              <p>Create a test property first to simulate inquiries</p>
            </div>
          ) : (
            <form onSubmit={handleSimulateInquiry} className="test-form">
              <div className="form-group">
                <label htmlFor="property">Select Property *</label>
                <select
                  id="property"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  required
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Initial Message *</label>
                <textarea
                  id="message"
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="Hi, I'm interested in this property..."
                  rows={4}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Simulating...' : 'Simulate Inquiry'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="info-box">
        <h3>About Test Mode</h3>
        <ul>
          <li>Test mode allows you to experiment with the system without connecting to real platforms</li>
          <li>Test properties are marked with a "Test Mode" badge throughout the system</li>
          <li>Simulated inquiries will trigger the full automated workflow</li>
          <li>You can configure pre-qualification questions and criteria for test properties</li>
          <li>All test data can be safely deleted without affecting production data</li>
        </ul>
      </div>
    </div>
  );
};

export default TestModePage;
