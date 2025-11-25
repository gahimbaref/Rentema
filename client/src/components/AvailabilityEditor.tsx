import { useState, useEffect } from 'react';
import { schedulingApi, TimeBlock } from '../api';
import './AvailabilityEditor.css';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AvailabilityEditor = () => {
  const [videoSchedule, setVideoSchedule] = useState<Record<string, TimeBlock[]>>({});
  const [tourSchedule, setTourSchedule] = useState<Record<string, TimeBlock[]>>({});
  const [scheduleType, setScheduleType] = useState<'video_call' | 'tour'>('video_call');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const [videoRes, tourRes] = await Promise.all([
        schedulingApi.getAvailability('video_call').catch(() => ({ data: null })),
        schedulingApi.getAvailability('tour').catch(() => ({ data: null })),
      ]);
      
      setVideoSchedule(videoRes.data?.recurringWeekly || {});
      setTourSchedule(tourRes.data?.recurringWeekly || {});
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const addTimeBlock = (day: string) => {
    const newBlock: TimeBlock = {
      startTime: '09:00',
      endTime: '17:00',
    };

    if (scheduleType === 'video_call') {
      setVideoSchedule(prev => ({
        ...prev,
        [day]: [...(prev[day] || []), newBlock],
      }));
    } else {
      setTourSchedule(prev => ({
        ...prev,
        [day]: [...(prev[day] || []), newBlock],
      }));
    }
  };

  const updateTimeBlock = (day: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    if (scheduleType === 'video_call') {
      setVideoSchedule(prev => {
        const dayBlocks = [...(prev[day] || [])];
        dayBlocks[index] = { ...dayBlocks[index], [field]: value };
        return { ...prev, [day]: dayBlocks };
      });
    } else {
      setTourSchedule(prev => {
        const dayBlocks = [...(prev[day] || [])];
        dayBlocks[index] = { ...dayBlocks[index], [field]: value };
        return { ...prev, [day]: dayBlocks };
      });
    }
  };

  const removeTimeBlock = (day: string, index: number) => {
    if (scheduleType === 'video_call') {
      setVideoSchedule(prev => ({
        ...prev,
        [day]: (prev[day] || []).filter((_, i) => i !== index),
      }));
    } else {
      setTourSchedule(prev => ({
        ...prev,
        [day]: (prev[day] || []).filter((_, i) => i !== index),
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const currentSchedule = scheduleType === 'video_call' ? videoSchedule : tourSchedule;
      await schedulingApi.setAvailability({
        scheduleType,
        recurringWeekly: currentSchedule,
        blockedDates: [],
      });
      alert('Availability saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const currentSchedule = scheduleType === 'video_call' ? videoSchedule : tourSchedule;

  if (loading) {
    return <div className="availability-editor"><p>Loading availability...</p></div>;
  }

  return (
    <div className="availability-editor">
      <div className="editor-header">
        <div>
          <h2>Availability Schedule</h2>
          <p className="subtitle">Set your availability for video calls and property tours</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="schedule-type-selector">
        <button
          className={`type-btn ${scheduleType === 'video_call' ? 'active' : ''}`}
          onClick={() => setScheduleType('video_call')}
        >
          Video Calls
        </button>
        <button
          className={`type-btn ${scheduleType === 'tour' ? 'active' : ''}`}
          onClick={() => setScheduleType('tour')}
        >
          Property Tours
        </button>
      </div>

      <div className="days-list">
        {DAYS.map((day) => (
          <div key={day} className="day-section">
            <div className="day-header">
              <h3>{day.charAt(0).toUpperCase() + day.slice(1)}</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => addTimeBlock(day)}
              >
                Add Time Block
              </button>
            </div>

            {(!currentSchedule[day] || currentSchedule[day].length === 0) ? (
              <p className="no-blocks">No availability set</p>
            ) : (
              <div className="time-blocks">
                {currentSchedule[day].map((block, index) => (
                  <div key={index} className="time-block">
                    <input
                      type="time"
                      value={block.startTime}
                      onChange={(e) => updateTimeBlock(day, index, 'startTime', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={block.endTime}
                      onChange={(e) => updateTimeBlock(day, index, 'endTime', e.target.value)}
                    />
                    <button
                      className="control-btn delete"
                      onClick={() => removeTimeBlock(day, index)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityEditor;
