import { useState, useEffect } from 'react';
import { schedulingApi, AvailabilitySchedule, Appointment } from '../api';
import AvailabilityEditor from '../components/AvailabilityEditor';
import './SchedulingPage.css';

const SchedulingPage = () => {
  const [availability, setAvailability] = useState<AvailabilitySchedule | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'availability' | 'appointments'>('availability');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [availabilityRes, appointmentsRes] = await Promise.all([
        schedulingApi.getAvailability(),
        schedulingApi.listAppointments(),
      ]);
      setAvailability(availabilityRes.data);
      setAppointments(appointmentsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = (updated: AvailabilitySchedule) => {
    setAvailability(updated);
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      await schedulingApi.cancelAppointment(id);
      await loadData();
      alert('Appointment cancelled successfully');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel appointment');
    }
  };

  const getAppointmentTypeLabel = (type: string) => {
    return type === 'video_call' ? 'Video Call' : 'Property Tour';
  };

  if (loading) return <div className="loading">Loading scheduling data...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="scheduling-page">
      <div className="page-header">
        <h1>Scheduling</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'availability' ? 'active' : ''}`}
          onClick={() => setActiveTab('availability')}
        >
          Availability
        </button>
        <button
          className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          Appointments ({appointments.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'availability' ? (
          <AvailabilityEditor
            availability={availability}
            onUpdate={handleAvailabilityUpdate}
          />
        ) : (
          <div className="appointments-section">
            <h2>Upcoming Appointments</h2>
            {appointments.length === 0 ? (
              <div className="empty-state">
                <p>No appointments scheduled</p>
              </div>
            ) : (
              <div className="appointments-list">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-header">
                      <div>
                        <h3>{getAppointmentTypeLabel(appointment.type)}</h3>
                        <p className="appointment-time">
                          {new Date(appointment.scheduledTime).toLocaleString()}
                        </p>
                      </div>
                      <span className="appointment-duration">{appointment.duration} min</span>
                    </div>

                    <div className="appointment-details">
                      {appointment.propertyAddress && (
                        <p><strong>Property:</strong> {appointment.propertyAddress}</p>
                      )}
                      {appointment.zoomLink && (
                        <p>
                          <strong>Zoom Link:</strong>{' '}
                          <a href={appointment.zoomLink} target="_blank" rel="noopener noreferrer">
                            Join Meeting
                          </a>
                        </p>
                      )}
                      <p><strong>Status:</strong> {appointment.status}</p>
                    </div>

                    <div className="appointment-actions">
                      <button
                        className="btn btn-danger"
                        onClick={() => handleCancelAppointment(appointment.id)}
                      >
                        Cancel Appointment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
