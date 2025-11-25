import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { TemplateEngine } from '../../engines/TemplateEngine';
import { getDatabasePool } from '../../database/connection';
import { TemplateType } from '../../models/types';

const router = Router();

const VALID_TEMPLATE_TYPES: TemplateType[] = [
  'pre_qualification_start',
  'pre_qualification_question',
  'qualification_success',
  'qualification_failure',
  'video_call_offer',
  'video_call_confirmation',
  'tour_confirmation',
  'reminder_24h',
  'reminder_2h'
];

// GET /templates - List all templates
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getDatabasePool();
    const templateEngine = new TemplateEngine(pool);

    const templates = [];
    for (const type of VALID_TEMPLATE_TYPES) {
      const template = await templateEngine.getTemplate(req.managerId!, type);
      templates.push(template);
    }

    res.json({ templates, total: templates.length });
  } catch (error) {
    next(error);
  }
});

// GET /templates/:type - Get specific template
router.get('/:type', async (req: AuthRequest, res: Response, next) => {
  try {
    const { type } = req.params;

    if (!VALID_TEMPLATE_TYPES.includes(type as TemplateType)) {
      throw new ValidationError(`Invalid template type. Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`);
    }

    const pool = getDatabasePool();
    const templateEngine = new TemplateEngine(pool);

    const template = await templateEngine.getTemplate(req.managerId!, type as TemplateType);

    res.json(template);
  } catch (error) {
    next(error);
  }
});

// PUT /templates/:type - Update template
router.put('/:type', async (req: AuthRequest, res: Response, next) => {
  try {
    const { type } = req.params;
    const { content, requiredVariables } = req.body;

    // Validation
    if (!VALID_TEMPLATE_TYPES.includes(type as TemplateType)) {
      throw new ValidationError(`Invalid template type. Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`);
    }

    if (!content || typeof content !== 'string') {
      throw new ValidationError('Content is required and must be a string');
    }

    if (!requiredVariables || !Array.isArray(requiredVariables)) {
      throw new ValidationError('Required variables must be an array');
    }

    const pool = getDatabasePool();
    const templateEngine = new TemplateEngine(pool);

    // Validate template before saving
    const validation = templateEngine.validateTemplate(content, requiredVariables);
    if (!validation.valid) {
      throw new ValidationError(
        `Template validation failed. Missing required variables: ${validation.missingVariables.join(', ')}`
      );
    }

    const template = await templateEngine.saveTemplate(
      req.managerId!,
      type as TemplateType,
      content,
      requiredVariables
    );

    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /templates/:type/reset - Reset to default
router.post('/:type/reset', async (req: AuthRequest, res: Response, next) => {
  try {
    const { type } = req.params;

    if (!VALID_TEMPLATE_TYPES.includes(type as TemplateType)) {
      throw new ValidationError(`Invalid template type. Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`);
    }

    const pool = getDatabasePool();
    const templateEngine = new TemplateEngine(pool);

    const template = await templateEngine.resetToDefault(req.managerId!, type as TemplateType);

    res.json({
      message: 'Template reset to default successfully',
      template,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
