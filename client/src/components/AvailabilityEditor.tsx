import { useState, useEffect } from 'react';
import { schedulingApi, AvailabilitySchedule, TimeBlock } from '../api';
import './AvailabilityEditor.css';

interface AvailabilityEditorProps {
  availability: AvailabilitySchedule | null;
  onUpdate: (availability: AvailabilitySchedule) => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AvailabilityEditor = ({ availability, onUpdate }: AvailabilityEditorProps) => {
  const [schedule, setSchedule] = useState<AvailabilitySchedule>({
    recurringWeekly: {},
    blockedDates: [],
    videoCallSchedule: {},
    tourSchedule: {},
  });
  const [scheduleType, setScheduleType] = useState<'general' | 'video' | 'tour'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (availability) {
      setSchedule(availability);
    }
  }, [availability]);

  const addTimeBlock = (day: string) => {
    const targetSchedule = scheduleType === 'video' 
      ? 'videoCallSchedule' 
      : scheduleType === 'tour' 
      ? 'tourSchedule' 
      : 'recurringWeekly';

    const newBlock: TimeBlock = {
      startTime: '09:00',
      endTime: '17:00',
    };

    setSchedule(prev => ({
      ...prev,
      [targetSchedule]: {
        ...prev[targetSchedule],
        [day]: [...(prev[targetSchedule]?.[day] || []), newBlock],
      },
    }));
  };

  const updateTimeBlock = (day: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    const targetSchedule = scheduleType === 'video' 
      ? 'videoCallSchedule' 
      : scheduleType === 'tour' 
      ? 'tourSchedule' 
      : 'recurringWeekly';

    setSchedule(prev => {
      const dayBlocks = [...(prev[targetSchedule]?.[day] || [])];
      dayBlocks[index] = { ...dayBlocks[index], [field]: value };
      return {
        ...prev,
        [targetSchedule]: {
          ...prev[targetSchedule],
          [day]: dayBlocks,
        },
      };
    });
  };

  const removeTimeBlock = (day: string, index: number) => {
    const targetSchedule = scheduleType === 'video' 
      ? 'videoCallSchedule' 
      : scheduleType === 'tour' 
      ? 'tourSchedule' 
      : 'recurringWeekly';

    setSchedule(prev => ({
      ...prev,
      [targetSchedule]: {
        ...prev[targetSchedule],
        [day]: (prev[targetSchedule]?.[day] || []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await schedulingApi.setAvailability(schedule);
      onUpdate(schedule);
      alert('Availability saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentSchedule = () => {
    return scheduleType === 'video' 
      ? schedule.videoCallSchedule || {}
      : scheduleType === 'tour' 
      ? schedule.tourSchedule || {}
      : schedule.recurringWeekly || {};
  };

  const currentSchedule = getCurrentSchedule();

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
          className={`type-btn ${scheduleType === 'general' ? 'active' : ''}`}
          onClick={() => setScheduleType('general')}
        >
          General Availability
        </button>
        <button
          className={`type-btn ${scheduleType === 'video' ? 'active' : ''}`}
          onClick={() => setScheduleType('video')}
        >
          Video Calls Only
        </button>
        <button
          className={`type-btn ${scheduleType === 'tour' ? 'active' : ''}`}
          onClick={() => setScheduleType('tour')}
        >
          Tours Only
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
