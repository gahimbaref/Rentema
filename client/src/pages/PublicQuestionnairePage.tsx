import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PublicQuestionnairePage.css';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
}

interface QuestionnaireData {
  inquiryId: string;
  tenantName: string;
  propertyAddress: string;
  propertyDetails: {
    bedrooms?: number;
    bathrooms?: number;
    rent?: number;
  } | null;
  questions: Question[];
}

export default function PublicQuestionnairePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuestionnaireData | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadQuestionnaire();
  }, [token]);

  const loadQuestionnaire = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/public/questionnaire/${token}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load questionnaire');
      }

      const questionnaireData = await response.json();
      setData(questionnaireData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!data) return;

    // Validate required fields
    const missingRequired = data.questions
      .filter(q => q.required)
      .find(q => !responses[q.id] || responses[q.id] === '');

    if (missingRequired) {
      setError(`Please answer the required question: ${missingRequired.text}`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formattedResponses = Object.entries(responses).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      const response = await fetch(`/api/public/questionnaire/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responses: formattedResponses }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit questionnaire');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id] || '';

    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            required={question.required}
            className="form-input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            required={question.required}
            className="form-input"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            required={question.required}
            className="form-textarea"
            rows={4}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            required={question.required}
            className="form-select"
          >
            <option value="">Select an option...</option>
            {question.options?.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="radio-group">
            {question.options?.map((option, idx) => (
              <label key={idx} className="radio-label">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  required={question.required}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="checkbox-group">
            {question.options?.map((option, idx) => (
              <label key={idx} className="checkbox-label">
                <input
                  type="checkbox"
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter(v => v !== option);
                    handleResponseChange(question.id, newValues);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      default:
        return null;
    }
  };


  if (loading) {
    return (
      <div className="public-questionnaire-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-questionnaire-page">
        <div className="error-container">
          <h2>Unable to Load Questionnaire</h2>
          <p className="error-message">{error}</p>
          <p className="error-hint">
            This link may have expired or already been used. Please contact the property manager for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="public-questionnaire-page">
        <div className="success-container">
          <div className="success-icon">✓</div>
          <h2>Thank You!</h2>
          <p>Your questionnaire has been submitted successfully.</p>
          <p>We'll review your responses and get back to you soon.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="public-questionnaire-page">
      <div className="questionnaire-container">
        <div className="questionnaire-header">
          <h1>Pre-Qualification Questionnaire</h1>
          <div className="property-info">
            <h2>{data.propertyAddress}</h2>
            {data.propertyDetails && (
              <div className="property-details">
                {data.propertyDetails.bedrooms && (
                  <span>{data.propertyDetails.bedrooms} bed</span>
                )}
                {data.propertyDetails.bathrooms && (
                  <span>{data.propertyDetails.bathrooms} bath</span>
                )}
                {data.propertyDetails.rent && (
                  <span>${data.propertyDetails.rent}/month</span>
                )}
              </div>
            )}
          </div>
          <p className="greeting">Hi {data.tenantName},</p>
          <p className="instructions">
            Please answer the following questions to help us process your application.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="questionnaire-form">
          {data.questions.map((question, index) => (
            <div key={question.id} className="question-block">
              <label className="question-label">
                {index + 1}. {question.text}
                {question.required && <span className="required">*</span>}
              </label>
              {renderQuestion(question)}
            </div>
          ))}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={submitting}
              className="submit-button"
            >
              {submitting ? 'Submitting...' : 'Submit Questionnaire'}
            </button>
          </div>

          <p className="required-note">* Required fields</p>
        </form>
      </div>
    </div>
  );
}
