import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { getPool } from '../../database/connection';

const router = Router();

// POST /properties - Create property
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { address, rentAmount, bedrooms, bathrooms, availabilityDate, isTestMode } = req.body;

    // Validation
    if (!address || typeof address !== 'string') {
      throw new ValidationError('Address is required and must be a string');
    }
    if (!rentAmount || typeof rentAmount !== 'number' || rentAmount <= 0) {
      throw new ValidationError('Rent amount is required and must be a positive number');
    }
    if (!bedrooms || typeof bedrooms !== 'number' || bedrooms <= 0) {
      throw new ValidationError('Bedrooms is required and must be a positive number');
    }
    if (!bathrooms || typeof bathrooms !== 'number' || bathrooms <= 0) {
      throw new ValidationError('Bathrooms is required and must be a positive number');
    }
    if (!availabilityDate) {
      throw new ValidationError('Availability date is required');
    }

    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);

    const property = await propertyRepo.create({
      managerId: req.managerId!,
      address,
      rentAmount,
      bedrooms,
      bathrooms,
      availabilityDate: new Date(availabilityDate),
      isTestMode: isTestMode || false,
      isArchived: false,
    });

    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
});

// GET /properties - List properties
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);

    const properties = await propertyRepo.findByManagerId(req.managerId!);

    res.json(properties);
  } catch (error) {
    next(error);
  }
});

// GET /properties/:id - Get property details
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);

    const property = await propertyRepo.findById(id);

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    // Verify ownership
    if (property.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    res.json(property);
  } catch (error) {
    next(error);
  }
});

// PUT /properties/:id - Update property
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { address, rentAmount, bedrooms, bathrooms, availabilityDate, isTestMode } = req.body;

    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);

    // Verify property exists and ownership
    const existingProperty = await propertyRepo.findById(id);
    if (!existingProperty) {
      throw new NotFoundError('Property not found');
    }
    if (existingProperty.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    // Build updates object
    const updates: any = {};
    if (address !== undefined) updates.address = address;
    if (rentAmount !== undefined) {
      if (typeof rentAmount !== 'number' || rentAmount <= 0) {
        throw new ValidationError('Rent amount must be a positive number');
      }
      updates.rentAmount = rentAmount;
    }
    if (bedrooms !== undefined) {
      if (typeof bedrooms !== 'number' || bedrooms <= 0) {
        throw new ValidationError('Bedrooms must be a positive number');
      }
      updates.bedrooms = bedrooms;
    }
    if (bathrooms !== undefined) {
      if (typeof bathrooms !== 'number' || bathrooms <= 0) {
        throw new ValidationError('Bathrooms must be a positive number');
      }
      updates.bathrooms = bathrooms;
    }
    if (availabilityDate !== undefined) {
      updates.availabilityDate = new Date(availabilityDate);
    }
    if (isTestMode !== undefined) {
      updates.isTestMode = isTestMode;
    }

    const updatedProperty = await propertyRepo.update(id, updates);

    res.json(updatedProperty);
  } catch (error) {
    next(error);
  }
});

// DELETE /properties/:id - Archive property
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const propertyRepo = new PropertyRepository(pool);

    // Verify property exists and ownership
    const existingProperty = await propertyRepo.findById(id);
    if (!existingProperty) {
      throw new NotFoundError('Property not found');
    }
    if (existingProperty.managerId !== req.managerId) {
      throw new NotFoundError('Property not found');
    }

    const archivedProperty = await propertyRepo.archive(id);

    res.json({ message: 'Property archived successfully', property: archivedProperty });
  } catch (error) {
    next(error);
  }
});

export default router;
