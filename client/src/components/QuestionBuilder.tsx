import { useState } from 'react';
import { questionsApi, Question } from '../api';
import './QuestionBuilder.css';

interface QuestionBuilderProps {
  propertyId: string;
  questions: Question[];
  onUpdate: (questions: Question[]) => void;
}

const QuestionBuilder = ({ propertyId, questions, onUpdate }: QuestionBuilderProps) => {
  const [editingQuestions, setEditingQuestions] = useState<Question[]>(questions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `temp-${Date.now()}`,
      propertyId,
      text: '',
      responseType: 'text',
      order: editingQuestions.length,
    };
    setEditingQuestions([...editingQuestions, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...editingQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditingQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = editingQuestions.filter((_, i) => i !== index);
    // Reorder remaining questions
    updated.forEach((q, i) => q.order = i);
    setEditingQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === editingQuestions.length - 1)
    ) {
      return;
    }

    const updated = [...editingQuestions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    
    // Update order
    updated.forEach((q, i) => q.order = i);
    setEditingQuestions(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (questions.length === 0) {
        await questionsApi.save(propertyId, editingQuestions);
      } else {
        await questionsApi.update(propertyId, editingQuestions);
      }
      onUpdate(editingQuestions);
      alert('Questions saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="question-builder">
      <div className="builder-header">
        <h2>Pre-Qualification Questions</h2>
        <button className="btn btn-primary" onClick={addQuestion}>
          Add Question
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {editingQuestions.length === 0 ? (
        <div className="empty-state">
          <p>No questions yet. Add your first pre-qualification question.</p>
        </div>
      ) : (
        <div className="questions-list">
          {editingQuestions.map((question, index) => (
            <div key={question.id} className="question-item">
              <div className="question-header">
                <span className="question-number">Question {index + 1}</span>
                <div className="question-controls">
                  <button
                    className="control-btn"
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="control-btn"
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === editingQuestions.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="control-btn delete"
                    onClick={() => removeQuestion(index)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="question-fields">
                <div className="form-group">
                  <label>Question Text *</label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    placeholder="Enter your question..."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Response Type *</label>
                    <select
                      value={question.responseType}
                      onChange={(e) => updateQuestion(index, 'responseType', e.target.value)}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes/No</option>
                      <option value="multiple_choice">Multiple Choice</option>
                    </select>
                  </div>
                </div>

                {question.responseType === 'multiple_choice' && (
                  <div className="form-group">
                    <label>Options (comma-separated) *</label>
                    <input
                      type="text"
                      value={question.options?.join(', ') || ''}
                      onChange={(e) => 
                        updateQuestion(index, 'options', e.target.value.split(',').map(s => s.trim()))
                      }
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="builder-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || editingQuestions.some(q => !q.text)}
        >
          {saving ? 'Saving...' : 'Save Questions'}
        </button>
      </div>
    </div>
  );
};

export default QuestionBuilder;
