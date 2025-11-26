import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './PublicBookingPage.css';

interface SlotInfo {
  startTime: string;
  endTime: string;
  appointmentType: string;
  date: string;
  time: string;
  duration: number;
}

export default function PublicBookingPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotInfo, setSlotInfo] = useState<SlotInfo | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [token]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/public/booking/${token}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load booking details');
      }

      const data = await response.json();
      setSlotInfo(data.slotInfo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      setError(null);

      const response = await fetch(`/api/public/booking/${token}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm booking');
      }

      setConfirmed(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="public-booking-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-booking-page">
        <div className="error-container">
          <h2>Unable to Load Booking</h2>
          <p className="error-message">{error}</p>
          <p className="error-hint">
            This booking link may have expired or already been used. Please contact the property manager for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="public-booking-page">
        <div className="success-container">
          <div className="success-icon">✓</div>
          <h2>Appointment Confirmed!</h2>
          <p>Your viewing appointment has been successfully booked.</p>
          <div className="confirmation-details">
            <p><strong>Date:</strong> {slotInfo?.date}</p>
            <p><strong>Time:</strong> {slotInfo?.time}</p>
            <p><strong>Duration:</strong> {slotInfo?.duration} minutes</p>
            <p><strong>Type:</strong> {slotInfo?.appointmentType === 'video_call' ? 'Video Call' : 'In-Person Tour'}</p>
          </div>
          <p className="confirmation-note">
            You'll receive a confirmation email shortly with all the details.
          </p>
        </div>
      </div>
    );
  }

  if (!slotInfo) {
    return null;
  }

  return (
    <div className="public-booking-page">
      <div className="booking-container">
        <div className="booking-header">
          <h1>Confirm Your Appointment</h1>
          <p>Please review the details below and confirm your booking.</p>
        </div>

        <div className="appointment-details">
          <div className="detail-row">
            <span className="detail-label">Date:</span>
            <span className="detail-value">{slotInfo.date}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time:</span>
            <span className="detail-value">{slotInfo.time}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Duration:</span>
            <span className="detail-value">{slotInfo.duration} minutes</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value">
              {slotInfo.appointmentType === 'video_call' ? 'Video Call' : 'In-Person Tour'}
            </span>
          </div>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div className="booking-actions">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="confirm-button"
          >
            {confirming ? 'Confirming...' : 'Confirm Appointment'}
          </button>
        </div>

        <p className="booking-note">
          By confirming, you agree to attend the appointment at the scheduled time.
        </p>
      </div>
    </div>
  );
}
