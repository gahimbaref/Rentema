import React from 'react';
import './WorkflowStatusBadge.css';

interface WorkflowStatusBadgeProps {
  status: string;
  sourceType?: string;
}

export default function WorkflowStatusBadge({ status, sourceType }: WorkflowStatusBadgeProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'new':
        return { label: 'New', color: 'blue', icon: '📬' };
      case 'questionnaire_sent':
        return { label: 'Questionnaire Sent', color: 'purple', icon: '📧' };
      case 'questionnaire_completed':
        return { label: 'Questionnaire Complete', color: 'teal', icon: '✅' };
      case 'pre_qualifying':
        return { label: 'Pre-Qualifying', color: 'orange', icon: '❓' };
      case 'qualified':
        return { label: 'Qualified', color: 'green', icon: '✓' };
      case 'disqualified':
        return { label: 'Disqualified', color: 'red', icon: '✗' };
      case 'appointment_scheduled':
        return { label: 'Appointment Scheduled', color: 'green', icon: '📅' };
      case 'appointment_completed':
        return { label: 'Completed', color: 'gray', icon: '✓' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'gray', icon: '✗' };
      default:
        return { label: status, color: 'gray', icon: '•' };
    }
  };

  const statusInfo = getStatusInfo();
  const isEmailWorkflow = sourceType === 'email';

  return (
    <div className={`workflow-status-badge status-${statusInfo.color}`}>
      <span className="status-icon">{statusInfo.icon}</span>
      <span className="status-label">{statusInfo.label}</span>
      {isEmailWorkflow && (
        <span className="workflow-type-badge" title="Email-based workflow">
          📧
        </span>
      )}
    </div>
  );
}
