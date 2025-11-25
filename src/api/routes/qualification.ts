import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { QualificationEngine } from '../../engines/QualificationEngine';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { getPool } from '../../database/connection';

const router = Router();

// POST /properties/:id/questions - Save questions
router.post('/:id/questions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id: propertyId } = req.params;
    const { questions } = req.body;

    // Validation
    if (!Array.isArray(questions)) {
      throw new ValidationError('Questions must be an array');
    }

    // Verify property exists and ownership
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);
    const property = await propertyRepo.findById(propertyId);

    if (!property) {
      throw new NotFoundError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    // Validate each question
    for (const question of questions) {
      if (!question.text || typeof question.text !== 'string') {
        throw new ValidationError('Each question must have a text field');
      }
      if (!question.responseType || !['text', 'number', 'boolean', 'multiple_choice'].includes(question.responseType)) {
        throw new ValidationError('Each question must have a valid responseType');
      }
      if (question.responseType === 'multiple_choice' && (!question.options || !Array.isArray(question.options))) {
        throw new ValidationError('Multiple choice questions must have options array');
      }
      if (question.order === undefined || typeof question.order !== 'number') {
        throw new ValidationError('Each question must have an order number');
      }
    }

    const qualificationEngine = new QualificationEngine(pool);
    const savedQuestions = await qualificationEngine.saveQuestions(propertyId, questions);

    res.status(201).json(savedQuestions);
  } catch (error) {
    next(error);
  }
});

// GET /properties/:id/questions - Get questions
router.get('/:id/questions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id: propertyId } = req.params;

    // Verify property exists and ownership
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);
    const property = await propertyRepo.findById(propertyId);

    if (!property) {
      throw new NotFoundError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    const qualificationEngine = new QualificationEngine(pool);
    const questions = await qualificationEngine.getQuestions(propertyId);

    res.json(questions);
  } catch (error) {
    next(error);
  }
});

// PUT /properties/:id/questions - Update questions (same as POST)
router.put('/:id/questions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id: propertyId } = req.params;
    const { questions } = req.body;

    // Validation
    if (!Array.isArray(questions)) {
      throw new ValidationError('Questions must be an array');
    }

    // Verify property exists and ownership
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);
    const property = await propertyRepo.findById(propertyId);

    if (!property) {
      throw new NotFoundError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    // Validate each question
    for (const question of questions) {
      if (!question.text || typeof question.text !== 'string') {
        throw new ValidationError('Each question must have a text field');
      }
      if (!question.responseType || !['text', 'number', 'boolean', 'multiple_choice'].includes(question.responseType)) {
        throw new ValidationError('Each question must have a valid responseType');
      }
      if (question.responseType === 'multiple_choice' && (!question.options || !Array.isArray(question.options))) {
        throw new ValidationError('Multiple choice questions must have options array');
      }
      if (question.order === undefined || typeof question.order !== 'number') {
        throw new ValidationError('Each question must have an order number');
      }
    }

    const qualificationEngine = new QualificationEngine(pool);
    const savedQuestions = await qualificationEngine.saveQuestions(propertyId, questions);

    res.json(savedQuestions);
  } catch (error) {
    next(error);
  }
});

// POST /properties/:id/criteria - Save qualification criteria
router.post('/:id/criteria', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id: propertyId } = req.params;
    const { criteria } = req.body;

    // Validation
    if (!Array.isArray(criteria)) {
      throw new ValidationError('Criteria must be an array');
    }

    // Verify property exists and ownership
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);
    const property = await propertyRepo.findById(propertyId);

    if (!property) {
      throw new NotFoundError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    // Filter out criteria with temp question IDs and validate
    const validCriteria = criteria.filter(criterion => {
      // Skip criteria with temp question IDs (questions not saved yet)
      if (criterion.questionId && criterion.questionId.startsWith('temp-')) {
        return false;
      }
      return true;
    });

    // Validate each criterion
    for (const criterion of validCriteria) {
      if (!criterion.questionId || typeof criterion.questionId !== 'string') {
        throw new ValidationError('Each criterion must have a questionId');
      }
      if (!criterion.operator || !['equals', 'greater_than', 'less_than', 'contains'].includes(criterion.operator)) {
        throw new ValidationError('Each criterion must have a valid operator');
      }
      if (criterion.expectedValue === undefined) {
        throw new ValidationError('Each criterion must have an expectedValue');
      }
    }

    // Remove id and createdAt fields (frontend may send temp IDs)
    const criteriaWithoutIds = validCriteria.map(({ id, createdAt, ...rest }) => rest);

    const qualificationEngine = new QualificationEngine(pool);
    const savedCriteria = await qualificationEngine.saveCriteria(propertyId, criteriaWithoutIds);

    res.status(201).json(savedCriteria);
  } catch (error) {
    next(error);
  }
});

// GET /properties/:id/criteria - Get criteria
router.get('/:id/criteria', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id: propertyId } = req.params;

    // Verify property exists and ownership
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);
    const property = await propertyRepo.findById(propertyId);

    if (!property) {
      throw new NotFoundError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    const qualificationEngine = new QualificationEngine(pool);
    const criteria = await qualificationEngine.getCriteria(propertyId);

    res.json(criteria);
  } catch (error) {
    next(error);
  }
});

export default router;
