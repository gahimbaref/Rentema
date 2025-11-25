import { useState } from 'react';
import { criteriaApi, Question, QualificationCriteria } from '../api';
import './CriteriaEditor.css';

interface CriteriaEditorProps {
  propertyId: string;
  questions: Question[];
  criteria: QualificationCriteria[];
  onUpdate: (criteria: QualificationCriteria[]) => void;
}

const CriteriaEditor = ({ propertyId, questions, criteria, onUpdate }: CriteriaEditorProps) => {
  const [editingCriteria, setEditingCriteria] = useState<QualificationCriteria[]>(criteria);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCriterion = () => {
    if (questions.length === 0) {
      alert('Please add questions first before creating criteria');
      return;
    }

    const newCriterion: QualificationCriteria = {
      id: `temp-${Date.now()}`,
      propertyId,
      questionId: questions[0].id,
      operator: 'equals',
      expectedValue: '',
    };
    setEditingCriteria([...editingCriteria, newCriterion]);
  };

  const updateCriterion = (index: number, field: keyof QualificationCriteria, value: any) => {
    const updated = [...editingCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setEditingCriteria(updated);
  };

  const removeCriterion = (index: number) => {
    const updated = editingCriteria.filter((_, i) => i !== index);
    setEditingCriteria(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await criteriaApi.save(propertyId, editingCriteria);
      onUpdate(editingCriteria);
      alert('Qualification criteria saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save criteria');
    } finally {
      setSaving(false);
    }
  };

  const getOperatorsForQuestion = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return ['equals'];

    switch (question.responseType) {
      case 'number':
        return ['equals', 'greater_than', 'less_than'];
      case 'text':
        return ['equals', 'contains'];
      case 'boolean':
        return ['equals'];
      case 'multiple_choice':
        return ['equals'];
      default:
        return ['equals'];
    }
  };

  const getInputTypeForQuestion = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return 'text';

    switch (question.responseType) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'select';
      case 'multiple_choice':
        return 'select';
      default:
        return 'text';
    }
  };

  const renderValueInput = (criterion: QualificationCriteria, index: number) => {
    const question = questions.find(q => q.id === criterion.questionId);
    const inputType = getInputTypeForQuestion(criterion.questionId);

    if (inputType === 'select') {
      if (question?.responseType === 'boolean') {
        return (
          <select
            value={criterion.expectedValue}
            onChange={(e) => updateCriterion(index, 'expectedValue', e.target.value === 'true')}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      } else if (question?.responseType === 'multiple_choice') {
        return (
          <select
            value={criterion.expectedValue}
            onChange={(e) => updateCriterion(index, 'expectedValue', e.target.value)}
          >
            <option value="">Select option...</option>
            {question.options?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      }
    }

    return (
      <input
        type={inputType}
        value={criterion.expectedValue}
        onChange={(e) => updateCriterion(index, 'expectedValue', 
          inputType === 'number' ? parseFloat(e.target.value) : e.target.value
        )}
        placeholder="Expected value..."
      />
    );
  };

  if (questions.length === 0) {
    return (
      <div className="empty-state">
        <p>Please add pre-qualification questions first before creating qualification criteria.</p>
      </div>
    );
  }

  return (
    <div className="criteria-editor">
      <div className="builder-header">
        <div>
          <h2>Qualification Criteria</h2>
          <p className="subtitle">Define rules to automatically qualify or disqualify tenants</p>
        </div>
        <button className="btn btn-primary" onClick={addCriterion}>
          Add Criterion
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {editingCriteria.length === 0 ? (
        <div className="empty-state">
          <p>No criteria yet. Add criteria to automatically evaluate tenant responses.</p>
        </div>
      ) : (
        <div className="criteria-list">
          {editingCriteria.map((criterion, index) => {
            const question = questions.find(q => q.id === criterion.questionId);
            return (
              <div key={criterion.id} className="criterion-item">
                <div className="criterion-header">
                  <span className="criterion-number">Criterion {index + 1}</span>
                  <button
                    className="control-btn delete"
                    onClick={() => removeCriterion(index)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>

                <div className="criterion-fields">
                  <div className="form-group">
                    <label>Question *</label>
                    <select
                      value={criterion.questionId}
                      onChange={(e) => updateCriterion(index, 'questionId', e.target.value)}
                    >
                      {questions.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Operator *</label>
                      <select
                        value={criterion.operator}
                        onChange={(e) => updateCriterion(index, 'operator', e.target.value)}
                      >
                        {getOperatorsForQuestion(criterion.questionId).map((op) => (
                          <option key={op} value={op}>
                            {op.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Expected Value *</label>
                      {renderValueInput(criterion, index)}
                    </div>
                  </div>

                  <div className="criterion-description">
                    <strong>Rule:</strong> {question?.text} {criterion.operator.replace('_', ' ')} {criterion.expectedValue?.toString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="builder-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || editingCriteria.some(c => !c.expectedValue)}
        >
          {saving ? 'Saving...' : 'Save Criteria'}
        </button>
      </div>
    </div>
  );
};

export default CriteriaEditor;
