import { Pool } from 'pg';
import {
  Question,
  QualificationCriteria,
  QualificationResult,
  Response
} from '../models';
import {
  QuestionRepository,
  ResponseRepository,
  QualificationCriteriaRepository,
  InquiryRepository
} from '../database/repositories';

export class QualificationEngine {
  private questionRepo: QuestionRepository;
  private responseRepo: ResponseRepository;
  private criteriaRepo: QualificationCriteriaRepository;
  private inquiryRepo: InquiryRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.questionRepo = new QuestionRepository(pool);
    this.responseRepo = new ResponseRepository(pool);
    this.criteriaRepo = new QualificationCriteriaRepository(pool);
    this.inquiryRepo = new InquiryRepository(pool);
  }

  /**
   * Save questions for a property
   * Deletes existing questions and creates new ones
   */
  async saveQuestions(propertyId: string, questions: Omit<Question, 'id' | 'createdAt'>[]): Promise<Question[]> {
    // Delete existing questions for this property
    await this.questionRepo.deleteByPropertyId(propertyId);
    
    // Create new questions
    const savedQuestions: Question[] = [];
    for (const question of questions) {
      const saved = await this.questionRepo.create({
        ...question,
        propertyId
      });
      savedQuestions.push(saved);
    }
    
    return savedQuestions;
  }

  /**
   * Get questions for a property
   */
  async getQuestions(propertyId: string): Promise<Question[]> {
    return await this.questionRepo.findByPropertyId(propertyId);
  }

  /**
   * Save a response to a question
   */
  async saveResponse(inquiryId: string, questionId: string, value: any): Promise<Response> {
    return await this.responseRepo.create({
      inquiryId,
      questionId,
      value
    });
  }

  /**
   * Save qualification criteria for a property
   */
  async saveCriteria(propertyId: string, criteria: Omit<QualificationCriteria, 'id' | 'createdAt'>[]): Promise<QualificationCriteria[]> {
    // Delete existing criteria for this property
    await this.criteriaRepo.deleteByPropertyId(propertyId);
    
    // Create new criteria
    const savedCriteria: QualificationCriteria[] = [];
    for (const criterion of criteria) {
      const saved = await this.criteriaRepo.create({
        ...criterion,
        propertyId
      });
      savedCriteria.push(saved);
    }
    
    return savedCriteria;
  }

  /**
   * Get qualification criteria for a property
   */
  async getCriteria(propertyId: string): Promise<QualificationCriteria[]> {
    return await this.criteriaRepo.findByPropertyId(propertyId);
  }

  /**
   * Evaluate qualification for an inquiry
   */
  async evaluateQualification(inquiryId: string): Promise<QualificationResult> {
    // Get the inquiry to find the property
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    // Get all responses for this inquiry
    const responses = await this.responseRepo.findByInquiryId(inquiryId);
    
    // Get qualification criteria for the property
    const criteria = await this.criteriaRepo.findByPropertyId(inquiry.propertyId);
    
    // If no criteria defined, consider qualified
    if (criteria.length === 0) {
      return { qualified: true };
    }

    // Evaluate each criterion
    const failedCriteria: QualificationCriteria[] = [];
    
    for (const criterion of criteria) {
      // Find the response for this question
      const response = responses.find(r => r.questionId === criterion.questionId);
      
      // If no response found, fail this criterion
      if (!response) {
        failedCriteria.push(criterion);
        continue;
      }

      // Evaluate based on operator
      const passed = this.evaluateCriterion(response.value, criterion.operator, criterion.expectedValue);
      
      if (!passed) {
        failedCriteria.push(criterion);
      }
    }

    return {
      qualified: failedCriteria.length === 0,
      failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined
    };
  }

  /**
   * Snapshot questions for an inquiry
   * This stores the current questions with the inquiry so historical inquiries
   * retain their original questions even if property questions are updated
   */
  async snapshotQuestionsForInquiry(inquiryId: string, propertyId: string): Promise<void> {
    // Get current questions for the property
    const questions = await this.questionRepo.findByPropertyId(propertyId);
    
    // Update the inquiry with the question snapshot
    await this.pool.query(
      'UPDATE inquiries SET question_snapshot = $1 WHERE id = $2',
      [JSON.stringify(questions), inquiryId]
    );
  }

  /**
   * Get questions for an inquiry (from snapshot if available, otherwise from property)
   */
  async getQuestionsForInquiry(inquiryId: string): Promise<Question[]> {
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    // If inquiry has a question snapshot, use it
    if (inquiry.questionSnapshot && inquiry.questionSnapshot.length > 0) {
      return inquiry.questionSnapshot;
    }

    // Otherwise, get current questions from property
    return await this.questionRepo.findByPropertyId(inquiry.propertyId);
  }

  /**
   * Evaluate a single criterion
   */
  private evaluateCriterion(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      
      case 'contains':
        if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
          return actualValue.toLowerCase().includes(expectedValue.toLowerCase());
        }
        if (Array.isArray(actualValue)) {
          return actualValue.includes(expectedValue);
        }
        return false;
      
      default:
        return false;
    }
  }
}
