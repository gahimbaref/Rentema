import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { propertiesApi, Property } from '../api';
import PropertyForm from '../components/PropertyForm';
import PageHeader from '../components/PageHeader';
import './PropertiesPage.css';

const PropertiesPage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const response = await propertiesApi.list();
      setProperties(response.data.filter(p => !p.isArchived));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProperty(null);
    setShowForm(true);
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this property?')) return;
    
    try {
      await propertiesApi.delete(id);
      await loadProperties();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete property');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProperty(null);
    loadProperties();
  };

  if (loading) return <div className="loading">Loading properties...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="properties-page">
      <PageHeader 
        title="Properties" 
        description="Manage your rental property portfolio"
      >
        <button className="btn btn-primary" onClick={handleCreate}>
          🏠 Add Property
        </button>
      </PageHeader>

      {showForm && (
        <PropertyForm
          property={editingProperty}
          onClose={handleFormClose}
        />
      )}

      {properties.length === 0 ? (
        <div className="empty-state">
          <p>No properties yet. Create your first property to get started.</p>
        </div>
      ) : (
        <div className="properties-grid">
          {properties.map((property) => (
            <div key={property.id} className="property-card">
              <div className="property-image">
                🏠
              </div>
              <div className="property-content">
                <div className="property-header">
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{property.address}</h3>
                  {property.isTestMode && <span className="badge" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>🧪 Test Mode</span>}
                </div>
                <div className="property-details" style={{ margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rent:</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: '700', fontSize: '1.1rem' }}>${property.rentAmount}/mo</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bedrooms:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{property.bedrooms} 🛏️</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bathrooms:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{property.bathrooms} 🚿</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Available:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>📅 {new Date(property.availabilityDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="property-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link to={`/properties/${property.id}`} className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                    📋 Details
                  </Link>
                  <Link to={`/properties/${property.id}/qualification`} className="btn btn-secondary" style={{ flex: '1 1 auto' }}>
                    ⚙️ Configure
                  </Link>
                  <button className="btn btn-secondary" onClick={() => handleEdit(property)} style={{ flex: '1 1 auto' }}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(property.id)} style={{ flex: '1 1 auto' }}>
                    🗑️ Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertiesPage;
