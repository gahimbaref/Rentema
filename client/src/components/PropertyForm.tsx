import { useState, useEffect } from 'react';
import { propertiesApi, Property } from '../api';
import './PropertyForm.css';

interface PropertyFormProps {
  property: Property | null;
  onClose: () => void;
}

const PropertyForm = ({ property, onClose }: PropertyFormProps) => {
  const [formData, setFormData] = useState({
    address: '',
    rentAmount: '',
    bedrooms: '',
    bathrooms: '',
    availabilityDate: '',
    isTestMode: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (property) {
      setFormData({
        address: property.address,
        rentAmount: property.rentAmount.toString(),
        bedrooms: property.bedrooms.toString(),
        bathrooms: property.bathrooms.toString(),
        availabilityDate: property.availabilityDate.split('T')[0],
        isTestMode: property.isTestMode,
      });
    }
  }, [property]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        address: formData.address,
        rentAmount: parseFloat(formData.rentAmount),
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseFloat(formData.bathrooms),
        availabilityDate: new Date(formData.availabilityDate).toISOString(),
        isTestMode: formData.isTestMode,
      };

      if (property) {
        await propertiesApi.update(property.id, data);
      } else {
        await propertiesApi.create(data);
      }

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{property ? 'Edit Property' : 'Add Property'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="address">Address *</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rentAmount">Monthly Rent ($) *</label>
              <input
                type="number"
                id="rentAmount"
                name="rentAmount"
                value={formData.rentAmount}
                onChange={handleChange}
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
                name="availabilityDate"
                value={formData.availabilityDate}
                onChange={handleChange}
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
                name="bedrooms"
                value={formData.bedrooms}
                onChange={handleChange}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bathrooms">Bathrooms *</label>
              <input
                type="number"
                id="bathrooms"
                name="bathrooms"
                value={formData.bathrooms}
                onChange={handleChange}
                min="0"
                step="0.5"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isTestMode"
                checked={formData.isTestMode}
                onChange={handleChange}
              />
              <span>Test Mode (for testing without real platform connections)</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : property ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyForm;
