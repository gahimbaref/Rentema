import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { inquiriesApi, propertiesApi, Inquiry, Property } from '../api';
import './InquiriesPage.css';

const InquiriesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    propertyId: searchParams.get('propertyId') || '',
    status: searchParams.get('status') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [inquiriesRes, propertiesRes] = await Promise.all([
        inquiriesApi.list({
          propertyId: filters.propertyId || undefined,
          status: filters.status || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
        propertiesApi.list(),
      ]);
      // Handle the response structure from the backend
      const inquiriesData = (inquiriesRes.data as any).inquiries || inquiriesRes.data || [];
      setInquiries(Array.isArray(inquiriesData) ? inquiriesData : []);
      setProperties(propertiesRes.data.filter(p => !p.isArchived));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load inquiries');
      setInquiries([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      propertyId: '',
      status: '',
      startDate: '',
      endDate: '',
    });
    setSearchParams(new URLSearchParams());
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

  const groupByProperty = () => {
    const grouped: Record<string, Inquiry[]> = {};
    // Ensure inquiries is an array
    const inquiriesArray = Array.isArray(inquiries) ? inquiries : [];
    inquiriesArray.forEach(inquiry => {
      if (!grouped[inquiry.propertyId]) {
        grouped[inquiry.propertyId] = [];
      }
      grouped[inquiry.propertyId].push(inquiry);
    });
    return grouped;
  };

  if (loading) return <div className="loading">Loading inquiries...</div>;
  if (error) return <div className="error">{error}</div>;

  const groupedInquiries = groupByProperty();

  return (
    <div className="inquiries-page">
      <div className="page-header">
        <h1>Inquiries Dashboard</h1>
      </div>

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Property</label>
            <select
              value={filters.propertyId}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
            >
              <option value="">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="pre_qualifying">Pre-Qualifying</option>
              <option value="qualified">Qualified</option>
              <option value="disqualified">Disqualified</option>
              <option value="video_call_scheduled">Video Call Scheduled</option>
              <option value="tour_scheduled">Tour Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {(filters.propertyId || filters.status || filters.startDate || filters.endDate) && (
          <button className="btn btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {inquiries.length === 0 ? (
        <div className="empty-state">
          <p>No inquiries found. {filters.propertyId || filters.status ? 'Try adjusting your filters.' : 'Inquiries will appear here when received from connected platforms.'}</p>
        </div>
      ) : (
        <div className="inquiries-content">
          {Object.entries(groupedInquiries).map(([propertyId, propertyInquiries]) => {
            const property = properties.find(p => p.id === propertyId);
            return (
              <div key={propertyId} className="property-group">
                <div className="property-group-header">
                  <h2>{property?.address || 'Unknown Property'}</h2>
                  <span className="inquiry-count">{propertyInquiries.length} inquiries</span>
                </div>

                <div className="inquiries-list">
                  {propertyInquiries.map(inquiry => (
                    <Link
                      key={inquiry.id}
                      to={`/inquiries/${inquiry.id}`}
                      className="inquiry-card"
                    >
                      <div className="inquiry-header">
                        <div>
                          <h3>{inquiry.prospectiveTenantName || 'Unknown Tenant'}</h3>
                          <p className="inquiry-date">
                            {new Date(inquiry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={`status-badge ${getStatusBadgeClass(inquiry.status)}`}>
                          {getStatusLabel(inquiry.status)}
                        </span>
                      </div>
                      <div className="inquiry-meta">
                        <span>ID: {inquiry.id.substring(0, 8)}...</span>
                        <span>Updated: {new Date(inquiry.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InquiriesPage;
