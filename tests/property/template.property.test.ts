/**
 * Property-based tests for Template Engine
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { TemplateEngine } from '../../src/engines/TemplateEngine';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Template Engine Property-Based Tests', () => {
  let pool: Pool;
  let templateEngine: TemplateEngine;
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
    
    templateEngine = new TemplateEngine(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up templates after each test
    await pool.query('DELETE FROM message_templates WHERE manager_id = $1', [testManagerId]);
  });

  /**
   * **Feature: rental-automation, Property 27: Template reset to default**
   * For any modified message template, resetting it should restore the original default template content
   * **Validates: Requirements 10.5**
   */
  it('Property 27: should restore default template content after reset', async () => {
    // Arbitrary for custom template content
    const customContentArbitrary = fc.string({ minLength: 10, maxLength: 200 });
    
    // Test with all template types
    const templateTypeArbitrary = fc.constantFrom(
      'pre_qualification_start',
      'pre_qualification_question',
      'qualification_success',
      'qualification_failure',
      'video_call_offer',
      'video_call_confirmation',
      'tour_confirmation',
      'reminder_24h',
      'reminder_2h'
    );

    await fc.assert(
      fc.asyncProperty(
        templateTypeArbitrary,
        customContentArbitrary,
        async (templateType, customContent) => {
          // Get the original default template content
          const originalDefault = await templateEngine.getTemplate(testManagerId, templateType as any);
          const originalContent = originalDefault.content;
          
          // Create a custom template with all required variables
          const customTemplateContent = customContent + ' ' + 
            originalDefault.requiredVariables.map(v => `{{${v}}}`).join(' ');
          
          // Save custom template
          await templateEngine.saveTemplate(
            testManagerId,
            templateType as any,
            customTemplateContent,
            originalDefault.requiredVariables
          );
          
          // Verify custom template is saved
          const customTemplate = await templateEngine.getTemplate(testManagerId, templateType as any);
          expect(customTemplate.content).toBe(customTemplateContent);
          
          // Reset to default
          await templateEngine.resetToDefault(testManagerId, templateType as any);
          
          // Verify template is restored to default
          const resetTemplate = await templateEngine.getTemplate(testManagerId, templateType as any);
          expect(resetTemplate.content).toBe(originalContent);
          expect(resetTemplate.requiredVariables).toEqual(originalDefault.requiredVariables);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 26: Template validation**
   * For any message template missing required variables,
   * attempting to save it should be rejected by validation
   * **Validates: Requirements 10.2**
   */
  it('Property 26: should reject templates missing required variables', async () => {
    // Arbitrary for variable names
    const variableNameArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/);
    
    // Generate template data with intentionally missing variables
    const templateDataArbitrary = fc.record({
      requiredVariables: fc.array(variableNameArbitrary, { minLength: 2, maxLength: 5 }),
      includedVariables: fc.array(variableNameArbitrary, { minLength: 0, maxLength: 3 })
    }).filter(data => {
      // Ensure at least one required variable is missing from the template
      const includedSet = new Set(data.includedVariables);
      return data.requiredVariables.some(v => !includedSet.has(v));
    }).map(data => {
      // Build template content with only some of the required variables
      const templateContent = data.includedVariables.map(name => `{{${name}}}`).join(' | ');
      return {
        templateContent,
        requiredVariables: data.requiredVariables
      };
    });

    await fc.assert(
      fc.asyncProperty(templateDataArbitrary, async (data) => {
        // Attempt to save template with missing required variables
        let errorThrown = false;
        try {
          await templateEngine.saveTemplate(
            testManagerId,
            'pre_qualification_start',
            data.templateContent,
            data.requiredVariables
          );
        } catch (error) {
          errorThrown = true;
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Template validation failed');
        }
        
        // Verify that an error was thrown
        expect(errorThrown).toBe(true);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 25: Template variable substitution**
   * For any message template with variables and provided variable values,
   * rendering the template should replace all template variables with their corresponding actual values
   * **Validates: Requirements 10.1, 10.3**
   */
  it('Property 25: should substitute all template variables with actual values', async () => {
    // Arbitrary for variable names (alphanumeric identifiers)
    const variableNameArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/);
    
    // Arbitrary for variable values (strings, numbers, or arrays of strings)
    const variableValueArbitrary = fc.oneof(
      fc.string({ minLength: 0, maxLength: 100 }),
      fc.integer({ min: 0, max: 100000 }),
      fc.float({ min: 0, max: 100000, noNaN: true }).map(n => Math.round(n * 100) / 100),
      fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 })
    );
    
    // Generate a template with random variables
    const templateDataArbitrary = fc.record({
      variables: fc.dictionary(variableNameArbitrary, variableValueArbitrary, { minKeys: 1, maxKeys: 5 })
    }).map(data => {
      // Build template content with placeholders
      const variableNames = Object.keys(data.variables);
      const templateContent = variableNames.map(name => `{{${name}}}`).join(' | ');
      
      return {
        templateContent,
        variables: data.variables,
        variableNames
      };
    });

    await fc.assert(
      fc.asyncProperty(templateDataArbitrary, async (data) => {
        // Save template
        await templateEngine.saveTemplate(
          testManagerId,
          'pre_qualification_start',
          data.templateContent,
          data.variableNames
        );
        
        // Render template with variables
        const rendered = await templateEngine.renderTemplate(
          testManagerId,
          'pre_qualification_start',
          data.variables
        );
        
        // Verify all variables were substituted
        for (const [key, value] of Object.entries(data.variables)) {
          const placeholder = `{{${key}}}`;
          
          // Placeholder should not appear in rendered output
          expect(rendered).not.toContain(placeholder);
          
          // Value should appear in rendered output
          if (Array.isArray(value)) {
            // For arrays, check that elements are present
            for (const item of value) {
              expect(rendered).toContain(String(item));
            }
          } else {
            expect(rendered).toContain(String(value));
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
