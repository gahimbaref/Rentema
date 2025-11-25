import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { propertiesApi, Property } from '../api';
import './PropertyDetailsPage.css';

const PropertyDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProperty(id);
    }
  }, [id]);

  const loadProperty = async (propertyId: string) => {
    try {
      setLoading(true);
      const response = await propertiesApi.get(propertyId);
      setProperty(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!property || !confirm('Are you sure you want to archive this property?')) return;
    
    try {
      await propertiesApi.delete(property.id);
      navigate('/properties');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete property');
    }
  };

  if (loading) return <div className="loading">Loading property...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!property) return <div className="error">Property not found</div>;

  return (
    <div className="property-details-page">
      <div className="page-header">
        <div>
          <Link to="/properties" className="back-link">← Back to Properties</Link>
          <h1>{property.address}</h1>
          {property.isTestMode && <span className="badge">Test Mode</span>}
        </div>
        <div className="header-actions">
          <Link to={`/properties/${property.id}/qualification`} className="btn btn-primary">
            Configure Pre-Qualification
          </Link>
          <button className="btn btn-danger" onClick={handleDelete}>
            Archive Property
          </button>
        </div>
      </div>

      <div className="details-grid">
        <div className="details-card">
          <h2>Property Information</h2>
          <div className="detail-row">
            <span className="detail-label">Address:</span>
            <span className="detail-value">{property.address}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Monthly Rent:</span>
            <span className="detail-value">${property.rentAmount}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Bedrooms:</span>
            <span className="detail-value">{property.bedrooms}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Bathrooms:</span>
            <span className="detail-value">{property.bathrooms}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Available Date:</span>
            <span className="detail-value">
              {new Date(property.availabilityDate).toLocaleDateString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className="detail-value">
              {property.isArchived ? 'Archived' : 'Active'}
            </span>
          </div>
        </div>

        <div className="details-card">
          <h2>System Information</h2>
          <div className="detail-row">
            <span className="detail-label">Property ID:</span>
            <span className="detail-value">{property.id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Created:</span>
            <span className="detail-value">
              {new Date(property.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Last Updated:</span>
            <span className="detail-value">
              {new Date(property.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Test Mode:</span>
            <span className="detail-value">
              {property.isTestMode ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      <div className="quick-links">
        <h2>Quick Actions</h2>
        <div className="links-grid">
          <Link to={`/inquiries?propertyId=${property.id}`} className="link-card">
            <h3>View Inquiries</h3>
            <p>See all inquiries for this property</p>
          </Link>
          <Link to={`/properties/${property.id}/qualification`} className="link-card">
            <h3>Pre-Qualification Setup</h3>
            <p>Configure questions and criteria</p>
          </Link>
          <Link to="/scheduling" className="link-card">
            <h3>Manage Availability</h3>
            <p>Set your scheduling availability</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetailsPage;
