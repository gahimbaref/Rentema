import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { questionsApi, criteriaApi, Question, QualificationCriteria } from '../api';
import QuestionBuilder from '../components/QuestionBuilder';
import CriteriaEditor from '../components/CriteriaEditor';
import './QualificationConfigPage.css';

const QualificationConfigPage = () => {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [criteria, setCriteria] = useState<QualificationCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'criteria'>('questions');

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (propertyId: string) => {
    try {
      setLoading(true);
      const [questionsRes, criteriaRes] = await Promise.all([
        questionsApi.list(propertyId),
        criteriaApi.list(propertyId),
      ]);
      setQuestions(questionsRes.data);
      setCriteria(criteriaRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionsUpdate = (updatedQuestions: Question[]) => {
    setQuestions(updatedQuestions);
  };

  const handleCriteriaUpdate = (updatedCriteria: QualificationCriteria[]) => {
    setCriteria(updatedCriteria);
  };

  if (loading) return <div className="loading">Loading configuration...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!id) return <div className="error">Property ID is required</div>;

  return (
    <div className="qualification-config-page">
      <div className="page-header">
        <div>
          <Link to={`/properties/${id}`} className="back-link">← Back to Property</Link>
          <h1>Pre-Qualification Configuration</h1>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          Questions ({questions.length})
        </button>
        <button
          className={`tab ${activeTab === 'criteria' ? 'active' : ''}`}
          onClick={() => setActiveTab('criteria')}
        >
          Qualification Criteria ({criteria.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'questions' ? (
          <QuestionBuilder
            propertyId={id}
            questions={questions}
            onUpdate={handleQuestionsUpdate}
          />
        ) : (
          <CriteriaEditor
            propertyId={id}
            questions={questions}
            criteria={criteria}
            onUpdate={handleCriteriaUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default QualificationConfigPage;
