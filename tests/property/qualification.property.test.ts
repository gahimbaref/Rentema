/**
 * Property-based tests for Qualification Engine
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { QualificationEngine } from '../../src/engines/QualificationEngine';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';
import { ResponseType, QualificationOperator } from '../../src/models';

describe('Qualification Engine Property-Based Tests', () => {
  let pool: Pool;
  let qualificationEngine: QualificationEngine;
  let propertyRepo: PropertyRepository;
  const testManagerId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    pool = createDatabasePool();
    await resetDatabase(pool);
    await runMigrations(pool);
    
    // Create a test property manager
    await pool.query(
      `INSERT INTO property_managers (id, email, name) VALUES ($1, $2, $3)`,
      [testManagerId, 'test@example.com', 'Test Manager']
    );
    
    qualificationEngine = new QualificationEngine(pool);
    propertyRepo = new PropertyRepository(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM questions');
    await pool.query('DELETE FROM properties');
  });

  /**
   * **Feature: rental-automation, Property 7: Pre-qualification question round-trip**
   * For any set of valid pre-qualification questions with response types,
   * storing them and retrieving them should return all questions with matching fields
   * **Validates: Requirements 3.1**
   */
  it('Property 7: should persist and retrieve pre-qualification questions correctly', async () => {
    // Arbitrary for response type
    const responseTypeArbitrary = fc.constantFrom<ResponseType>(
      'text',
      'number',
      'boolean',
      'multiple_choice'
    );

    // Arbitrary for a single question
    const questionArbitrary = fc.record({
      text: fc.string({ minLength: 5, maxLength: 200 }),
      responseType: responseTypeArbitrary,
      options: fc.option(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        { nil: undefined }
      ),
      order: fc.integer({ min: 0, max: 100 }),
      version: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined })
    });

    // Arbitrary for an array of questions
    const questionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 10 });

    await fc.assert(
      fc.asyncProperty(questionsArbitrary, async (questionsData) => {
        // Create a test property
        const property = await propertyRepo.create({
          managerId: testManagerId,
          address: '123 Test St',
          rentAmount: 1000,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date(),
          isTestMode: true,
          isArchived: false
        });

        // Prepare questions with propertyId
        const questionsToSave = questionsData.map(q => ({
          ...q,
          propertyId: property.id
        }));

        // Save questions
        const savedQuestions = await qualificationEngine.saveQuestions(property.id, questionsToSave);

        // Retrieve questions
        const retrievedQuestions = await qualificationEngine.getQuestions(property.id);

        // Verify count matches
        expect(retrievedQuestions.length).toBe(savedQuestions.length);

        // Verify each question's fields match
        for (let i = 0; i < savedQuestions.length; i++) {
          const saved = savedQuestions[i];
          const retrieved = retrievedQuestions.find(q => q.id === saved.id);

          expect(retrieved).toBeDefined();
          expect(retrieved!.propertyId).toBe(property.id);
          expect(retrieved!.text).toBe(saved.text);
          expect(retrieved!.responseType).toBe(saved.responseType);
          expect(retrieved!.order).toBe(saved.order);
          
          // Handle options comparison (can be null, undefined, or array)
          if (saved.options) {
            expect(retrieved!.options).toEqual(saved.options);
          } else {
            // Database stores undefined as null
            expect(retrieved!.options == null).toBe(true);
          }
          
          if (saved.version !== undefined) {
            expect(retrieved!.version).toBe(saved.version);
          }
        }

        // Clean up - delete questions first due to foreign key constraint
        await pool.query('DELETE FROM questions WHERE property_id = $1', [property.id]);
        await propertyRepo.delete(property.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 8: Question-property association**
   * For any property with associated questions, retrieving questions for that property
   * should return only the questions associated with it and not questions from other properties
   * **Validates: Requirements 3.2**
   */
  it('Property 8: should isolate questions by property', async () => {
    const responseTypeArbitrary = fc.constantFrom<ResponseType>(
      'text',
      'number',
      'boolean',
      'multiple_choice'
    );

    const questionArbitrary = fc.record({
      text: fc.string({ minLength: 5, maxLength: 200 }),
      responseType: responseTypeArbitrary,
      options: fc.option(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        { nil: undefined }
      ),
      order: fc.integer({ min: 0, max: 100 }),
      version: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined })
    });

    // Generate questions for two different properties
    const property1QuestionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 5 });
    const property2QuestionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(
        property1QuestionsArbitrary,
        property2QuestionsArbitrary,
        async (property1Questions, property2Questions) => {
          // Create two test properties
          const property1 = await propertyRepo.create({
            managerId: testManagerId,
            address: '123 Test St',
            rentAmount: 1000,
            bedrooms: 2,
            bathrooms: 1,
            availabilityDate: new Date(),
            isTestMode: true,
            isArchived: false
          });

          const property2 = await propertyRepo.create({
            managerId: testManagerId,
            address: '456 Test Ave',
            rentAmount: 1500,
            bedrooms: 3,
            bathrooms: 2,
            availabilityDate: new Date(),
            isTestMode: true,
            isArchived: false
          });

          // Save questions for property 1
          const saved1 = await qualificationEngine.saveQuestions(
            property1.id,
            property1Questions.map(q => ({ ...q, propertyId: property1.id }))
          );

          // Save questions for property 2
          const saved2 = await qualificationEngine.saveQuestions(
            property2.id,
            property2Questions.map(q => ({ ...q, propertyId: property2.id }))
          );

          // Retrieve questions for property 1
          const retrieved1 = await qualificationEngine.getQuestions(property1.id);

          // Retrieve questions for property 2
          const retrieved2 = await qualificationEngine.getQuestions(property2.id);

          // Verify property 1 questions are isolated
          expect(retrieved1.length).toBe(saved1.length);
          for (const question of retrieved1) {
            expect(question.propertyId).toBe(property1.id);
          }

          // Verify property 2 questions are isolated
          expect(retrieved2.length).toBe(saved2.length);
          for (const question of retrieved2) {
            expect(question.propertyId).toBe(property2.id);
          }

          // Verify no overlap - property 1 questions should not appear in property 2 results
          const property1Ids = new Set(retrieved1.map(q => q.id));
          const property2Ids = new Set(retrieved2.map(q => q.id));
          
          for (const id of property1Ids) {
            expect(property2Ids.has(id)).toBe(false);
          }

          // Clean up
          await pool.query('DELETE FROM questions WHERE property_id = $1', [property1.id]);
          await pool.query('DELETE FROM questions WHERE property_id = $1', [property2.id]);
          await propertyRepo.delete(property1.id);
          await propertyRepo.delete(property2.id);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 9: Question versioning isolation**
   * For any property with existing inquiries, editing the pre-qualification questions
   * should apply changes only to new inquiries while existing inquiries retain their original questions
   * **Validates: Requirements 3.3**
   */
  it('Property 9: should isolate question changes from existing inquiries', async () => {
    const responseTypeArbitrary = fc.constantFrom<ResponseType>(
      'text',
      'number',
      'boolean',
      'multiple_choice'
    );

    const questionArbitrary = fc.record({
      text: fc.string({ minLength: 5, maxLength: 200 }),
      responseType: responseTypeArbitrary,
      options: fc.option(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        { nil: undefined }
      ),
      order: fc.integer({ min: 0, max: 100 }),
      version: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined })
    });

    const originalQuestionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 5 });
    const updatedQuestionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(
        originalQuestionsArbitrary,
        updatedQuestionsArbitrary,
        async (originalQuestions, updatedQuestions) => {
          // Create a test property
          const property = await propertyRepo.create({
            managerId: testManagerId,
            address: '123 Test St',
            rentAmount: 1000,
            bedrooms: 2,
            bathrooms: 1,
            availabilityDate: new Date(),
            isTestMode: true,
            isArchived: false
          });

          // Create a platform connection for the inquiry
          const platformResult = await pool.query(
            `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [testManagerId, 'test', JSON.stringify({}), true]
          );
          const platformId = platformResult.rows[0].id;

          // Save original questions
          await qualificationEngine.saveQuestions(
            property.id,
            originalQuestions.map(q => ({ ...q, propertyId: property.id }))
          );

          // Create an inquiry
          const inquiryResult = await pool.query(
            `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, 
                                    prospective_tenant_id, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [property.id, platformId, 'ext-123', 'tenant-123', 'new']
          );
          const inquiryId = inquiryResult.rows[0].id;

          // Snapshot questions for the inquiry
          await qualificationEngine.snapshotQuestionsForInquiry(inquiryId, property.id);

          // Get questions for the inquiry (should be original)
          const inquiryQuestions = await qualificationEngine.getQuestionsForInquiry(inquiryId);

          // Update property questions
          await qualificationEngine.saveQuestions(
            property.id,
            updatedQuestions.map(q => ({ ...q, propertyId: property.id }))
          );

          // Get questions for the inquiry again (should still be original)
          const inquiryQuestionsAfterUpdate = await qualificationEngine.getQuestionsForInquiry(inquiryId);

          // Get current property questions (should be updated)
          const currentPropertyQuestions = await qualificationEngine.getQuestions(property.id);

          // Verify inquiry questions haven't changed
          expect(inquiryQuestionsAfterUpdate.length).toBe(inquiryQuestions.length);
          for (let i = 0; i < inquiryQuestions.length; i++) {
            expect(inquiryQuestionsAfterUpdate[i].text).toBe(inquiryQuestions[i].text);
            expect(inquiryQuestionsAfterUpdate[i].responseType).toBe(inquiryQuestions[i].responseType);
            expect(inquiryQuestionsAfterUpdate[i].order).toBe(inquiryQuestions[i].order);
          }

          // Verify property questions have changed
          expect(currentPropertyQuestions.length).toBe(updatedQuestions.length);

          // Clean up
          await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]);
          await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
          await pool.query('DELETE FROM questions WHERE property_id = $1', [property.id]);
          await propertyRepo.delete(property.id);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 11: Response storage completeness**
   * For any inquiry where all pre-qualification questions are answered,
   * the system should store all responses with timestamps
   * **Validates: Requirements 4.4**
   */
  it('Property 11: should store all responses with timestamps', async () => {
    const responseTypeArbitrary = fc.constantFrom<ResponseType>(
      'text',
      'number',
      'boolean',
      'multiple_choice'
    );

    const questionArbitrary = fc.record({
      text: fc.string({ minLength: 5, maxLength: 200 }),
      responseType: responseTypeArbitrary,
      options: fc.option(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        { nil: undefined }
      ),
      order: fc.integer({ min: 0, max: 100 }),
      version: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined })
    });

    const questionsArbitrary = fc.array(questionArbitrary, { minLength: 1, maxLength: 10 });

    await fc.assert(
      fc.asyncProperty(questionsArbitrary, async (questionsData) => {
        // Create a test property
        const property = await propertyRepo.create({
          managerId: testManagerId,
          address: '123 Test St',
          rentAmount: 1000,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date(),
          isTestMode: true,
          isArchived: false
        });

        // Create a platform connection
        const platformResult = await pool.query(
          `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [testManagerId, 'test', JSON.stringify({}), true]
        );
        const platformId = platformResult.rows[0].id;

        // Save questions
        const savedQuestions = await qualificationEngine.saveQuestions(
          property.id,
          questionsData.map(q => ({ ...q, propertyId: property.id }))
        );

        // Create an inquiry
        const inquiryResult = await pool.query(
          `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, 
                                  prospective_tenant_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [property.id, platformId, 'ext-123', 'tenant-123', 'pre_qualifying']
        );
        const inquiryId = inquiryResult.rows[0].id;

        // Save responses for all questions
        const savedResponses = [];
        for (const question of savedQuestions) {
          // Generate appropriate response value based on type
          let responseValue: any;
          switch (question.responseType) {
            case 'text':
              responseValue = 'Test response';
              break;
            case 'number':
              responseValue = 42;
              break;
            case 'boolean':
              responseValue = true;
              break;
            case 'multiple_choice':
              responseValue = question.options?.[0] || 'Option 1';
              break;
          }

          const response = await qualificationEngine.saveResponse(
            inquiryId,
            question.id,
            responseValue
          );
          savedResponses.push(response);
        }

        // Retrieve all responses for the inquiry
        const retrievedResponses = await pool.query(
          `SELECT id, inquiry_id as "inquiryId", question_id as "questionId", 
                  value, timestamp
           FROM responses WHERE inquiry_id = $1 ORDER BY timestamp ASC`,
          [inquiryId]
        );

        // Verify all responses were stored
        expect(retrievedResponses.rows.length).toBe(savedQuestions.length);

        // Verify each response has required fields
        for (const response of retrievedResponses.rows) {
          expect(response.id).toBeDefined();
          expect(response.inquiryId).toBe(inquiryId);
          expect(response.questionId).toBeDefined();
          expect(response.value).toBeDefined();
          expect(response.timestamp).toBeDefined();
          expect(response.timestamp).toBeInstanceOf(Date);
        }

        // Verify all question IDs are present in responses
        const responseQuestionIds = new Set(retrievedResponses.rows.map((r: any) => r.questionId));
        for (const question of savedQuestions) {
          expect(responseQuestionIds.has(question.id)).toBe(true);
        }

        // Clean up
        await pool.query('DELETE FROM responses WHERE inquiry_id = $1', [inquiryId]);
        await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]);
        await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
        await pool.query('DELETE FROM questions WHERE property_id = $1', [property.id]);
        await propertyRepo.delete(property.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 12: Qualification criteria persistence**
   * For any valid set of qualification criteria, storing them and retrieving them
   * should return matching criteria rules
   * **Validates: Requirements 5.1**
   */
  it('Property 12: should persist and retrieve qualification criteria correctly', async () => {
    const operatorArbitrary = fc.constantFrom<QualificationOperator>(
      'equals',
      'greater_than',
      'less_than',
      'contains'
    );

    const criterionArbitrary = fc.record({
      questionId: fc.uuid(),
      operator: operatorArbitrary,
      expectedValue: fc.oneof(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: 10000 }),
        fc.boolean()
      )
    });

    const criteriaArbitrary = fc.array(criterionArbitrary, { minLength: 1, maxLength: 10 });

    await fc.assert(
      fc.asyncProperty(criteriaArbitrary, async (criteriaData) => {
        // Create a test property
        const property = await propertyRepo.create({
          managerId: testManagerId,
          address: '123 Test St',
          rentAmount: 1000,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date(),
          isTestMode: true,
          isArchived: false
        });

        // Create questions for the criteria to reference
        const questions = [];
        for (const criterion of criteriaData) {
          const question = await pool.query(
            `INSERT INTO questions (id, property_id, text, response_type, order_index)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [criterion.questionId, property.id, 'Test question', 'text', 0]
          );
          questions.push(question.rows[0].id);
        }

        // Prepare criteria with propertyId
        const criteriaToSave = criteriaData.map(c => ({
          ...c,
          propertyId: property.id
        }));

        // Save criteria
        const savedCriteria = await qualificationEngine.saveCriteria(property.id, criteriaToSave);

        // Retrieve criteria
        const retrievedCriteria = await qualificationEngine.getCriteria(property.id);

        // Verify count matches
        expect(retrievedCriteria.length).toBe(savedCriteria.length);

        // Verify each criterion's fields match
        for (const saved of savedCriteria) {
          const retrieved = retrievedCriteria.find(c => c.id === saved.id);

          expect(retrieved).toBeDefined();
          expect(retrieved!.propertyId).toBe(property.id);
          expect(retrieved!.questionId).toBe(saved.questionId);
          expect(retrieved!.operator).toBe(saved.operator);
          expect(retrieved!.expectedValue).toEqual(saved.expectedValue);
          expect(retrieved!.createdAt).toBeDefined();
        }

        // Clean up
        await pool.query('DELETE FROM qualification_criteria WHERE property_id = $1', [property.id]);
        await pool.query('DELETE FROM questions WHERE property_id = $1', [property.id]);
        await propertyRepo.delete(property.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 13: Qualification evaluation correctness**
   * For any inquiry with complete responses and defined qualification criteria,
   * evaluating the inquiry should mark it as qualified if all criteria are met,
   * or disqualified if any criterion fails
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it('Property 13: should correctly evaluate qualification based on criteria', async () => {
    // Test both passing and failing scenarios
    const scenarioArbitrary = fc.constantFrom('all_pass', 'some_fail');

    await fc.assert(
      fc.asyncProperty(scenarioArbitrary, async (scenario) => {
        // Create a test property
        const property = await propertyRepo.create({
          managerId: testManagerId,
          address: '123 Test St',
          rentAmount: 1000,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date(),
          isTestMode: true,
          isArchived: false
        });

        // Create a platform connection
        const platformResult = await pool.query(
          `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [testManagerId, 'test', JSON.stringify({}), true]
        );
        const platformId = platformResult.rows[0].id;

        // Create questions
        const incomeQuestion = await pool.query(
          `INSERT INTO questions (property_id, text, response_type, order_index)
           VALUES ($1, $2, $3, $4)
           RETURNING id, property_id as "propertyId", text, response_type as "responseType", 
                     order_index as "order", created_at as "createdAt"`,
          [property.id, 'What is your monthly income?', 'number', 1]
        );

        const creditQuestion = await pool.query(
          `INSERT INTO questions (property_id, text, response_type, order_index)
           VALUES ($1, $2, $3, $4)
           RETURNING id, property_id as "propertyId", text, response_type as "responseType", 
                     order_index as "order", created_at as "createdAt"`,
          [property.id, 'What is your credit score?', 'number', 2]
        );

        const incomeQuestionId = incomeQuestion.rows[0].id;
        const creditQuestionId = creditQuestion.rows[0].id;

        // Create qualification criteria
        await qualificationEngine.saveCriteria(property.id, [
          {
            propertyId: property.id,
            questionId: incomeQuestionId,
            operator: 'greater_than',
            expectedValue: 3000
          },
          {
            propertyId: property.id,
            questionId: creditQuestionId,
            operator: 'greater_than',
            expectedValue: 650
          }
        ]);

        // Create an inquiry
        const inquiryResult = await pool.query(
          `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, 
                                  prospective_tenant_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [property.id, platformId, 'ext-123', 'tenant-123', 'pre_qualifying']
        );
        const inquiryId = inquiryResult.rows[0].id;

        // Save responses based on scenario
        if (scenario === 'all_pass') {
          // Responses that meet all criteria
          await qualificationEngine.saveResponse(inquiryId, incomeQuestionId, 4000);
          await qualificationEngine.saveResponse(inquiryId, creditQuestionId, 700);
        } else {
          // Responses that fail at least one criterion
          await qualificationEngine.saveResponse(inquiryId, incomeQuestionId, 2500); // Fails
          await qualificationEngine.saveResponse(inquiryId, creditQuestionId, 700);
        }

        // Evaluate qualification
        const result = await qualificationEngine.evaluateQualification(inquiryId);

        // Verify result based on scenario
        if (scenario === 'all_pass') {
          expect(result.qualified).toBe(true);
          expect(result.failedCriteria).toBeUndefined();
        } else {
          expect(result.qualified).toBe(false);
          expect(result.failedCriteria).toBeDefined();
          expect(result.failedCriteria!.length).toBeGreaterThan(0);
          
          // Verify the failed criterion is the income one
          const failedIncomeCriterion = result.failedCriteria!.find(
            c => c.questionId === incomeQuestionId
          );
          expect(failedIncomeCriterion).toBeDefined();
        }

        // Clean up
        await pool.query('DELETE FROM responses WHERE inquiry_id = $1', [inquiryId]);
        await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]);
        await pool.query('DELETE FROM qualification_criteria WHERE property_id = $1', [property.id]);
        await pool.query('DELETE FROM questions WHERE property_id = $1', [property.id]);
        await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
        await propertyRepo.delete(property.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
