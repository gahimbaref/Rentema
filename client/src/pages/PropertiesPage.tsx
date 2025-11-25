import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { propertiesApi, Property } from '../api';
import PropertyForm from '../components/PropertyForm';
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
      <div className="page-header">
        <h1>Properties</h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          Add Property
        </button>
      </div>

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
              <div className="property-header">
                <h3>{property.address}</h3>
                {property.isTestMode && <span className="badge">Test Mode</span>}
              </div>
              <div className="property-details">
                <p><strong>Rent:</strong> ${property.rentAmount}/month</p>
                <p><strong>Bedrooms:</strong> {property.bedrooms}</p>
                <p><strong>Bathrooms:</strong> {property.bathrooms}</p>
                <p><strong>Available:</strong> {new Date(property.availabilityDate).toLocaleDateString()}</p>
              </div>
              <div className="property-actions">
                <Link to={`/properties/${property.id}`} className="btn btn-secondary">
                  View Details
                </Link>
                <Link to={`/properties/${property.id}/qualification`} className="btn btn-secondary">
                  Configure
                </Link>
                <button className="btn btn-secondary" onClick={() => handleEdit(property)}>
                  Edit
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(property.id)}>
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertiesPage;
