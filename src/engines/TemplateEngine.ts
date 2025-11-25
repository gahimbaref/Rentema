import { Pool } from 'pg';
import { MessageTemplate, TemplateType } from '../models/types';
import { MessageTemplateRepository } from '../database/repositories';

export interface TemplateVariables {
  tenantName?: string;
  propertyAddress?: string;
  rentAmount?: number;
  timeSlots?: string[];
  appointmentTime?: string;
  zoomLink?: string;
  [key: string]: any;
}

// Default templates for all message types
const DEFAULT_TEMPLATES: Record<TemplateType, { content: string; requiredVariables: string[] }> = {
  pre_qualification_start: {
    content: 'Hi {{tenantName}}, thank you for your interest in {{propertyAddress}}! To help us process your application, we have a few quick questions. Let\'s get started!',
    requiredVariables: ['tenantName', 'propertyAddress']
  },
  pre_qualification_question: {
    content: '{{questionText}}',
    requiredVariables: ['questionText']
  },
  qualification_success: {
    content: 'Great news {{tenantName}}! You meet our initial qualifications for {{propertyAddress}}. We\'d love to schedule a time to speak with you.',
    requiredVariables: ['tenantName', 'propertyAddress']
  },
  qualification_failure: {
    content: 'Thank you for your interest in {{propertyAddress}}, {{tenantName}}. Unfortunately, we are unable to move forward with your application at this time. We wish you the best in your housing search.',
    requiredVariables: ['tenantName', 'propertyAddress']
  },
  video_call_offer: {
    content: 'Hi {{tenantName}}! We have the following time slots available for a video call about {{propertyAddress}}:\n{{timeSlots}}\n\nPlease reply with your preferred time.',
    requiredVariables: ['tenantName', 'propertyAddress', 'timeSlots']
  },
  video_call_confirmation: {
    content: 'Your video call for {{propertyAddress}} is confirmed for {{appointmentTime}}. Join here: {{zoomLink}}',
    requiredVariables: ['propertyAddress', 'appointmentTime', 'zoomLink']
  },
  tour_confirmation: {
    content: 'Your property tour is confirmed for {{appointmentTime}} at {{propertyAddress}}. We look forward to seeing you!',
    requiredVariables: ['appointmentTime', 'propertyAddress']
  },
  reminder_24h: {
    content: 'Reminder: You have an appointment tomorrow at {{appointmentTime}} for {{propertyAddress}}.',
    requiredVariables: ['appointmentTime', 'propertyAddress']
  },
  reminder_2h: {
    content: 'Reminder: Your appointment at {{propertyAddress}} is in 2 hours ({{appointmentTime}}).',
    requiredVariables: ['appointmentTime', 'propertyAddress']
  }
};

export class TemplateEngine {
  private repository: MessageTemplateRepository;

  constructor(pool: Pool) {
    this.repository = new MessageTemplateRepository(pool);
  }

  /**
   * Validate that a template contains all required variables
   */
  validateTemplate(content: string, requiredVariables: string[]): { valid: boolean; missingVariables: string[] } {
    const missingVariables: string[] = [];
    
    for (const variable of requiredVariables) {
      const placeholder = `{{${variable}}}`;
      if (!content.includes(placeholder)) {
        missingVariables.push(variable);
      }
    }
    
    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }

  /**
   * Save a custom template for a property manager
   */
  async saveTemplate(
    managerId: string,
    type: TemplateType,
    content: string,
    requiredVariables: string[]
  ): Promise<MessageTemplate> {
    // Validate template before saving
    const validation = this.validateTemplate(content, requiredVariables);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed. Missing required variables: ${validation.missingVariables.join(', ')}`
      );
    }
    
    return this.repository.save({
      managerId,
      type,
      content,
      requiredVariables,
      isDefault: false
    });
  }

  /**
   * Get a template for a property manager, falling back to default if not found
   */
  async getTemplate(managerId: string, type: TemplateType): Promise<MessageTemplate> {
    // Try to get custom template first
    const customTemplate = await this.repository.findByManagerAndType(managerId, type);
    if (customTemplate) {
      return customTemplate;
    }

    // Fall back to default template
    const defaultTemplate = await this.repository.findDefaultByType(type);
    if (defaultTemplate) {
      return defaultTemplate;
    }

    // If no default exists in DB, return the hardcoded default
    const hardcodedDefault = DEFAULT_TEMPLATES[type];
    return {
      id: 'default-' + type,
      managerId: 'system',
      type,
      content: hardcodedDefault.content,
      requiredVariables: hardcodedDefault.requiredVariables,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Render a template by replacing variables with actual values
   */
  async renderTemplate(
    managerId: string,
    type: TemplateType,
    variables: TemplateVariables
  ): Promise<string> {
    const template = await this.getTemplate(managerId, type);
    
    let rendered = template.content;
    
    // Replace all variables in the format {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      let replacement: string;
      
      if (Array.isArray(value)) {
        // For arrays (like timeSlots), join with newlines
        replacement = value.join('\n');
      } else if (value === null || value === undefined) {
        replacement = '';
      } else {
        replacement = String(value);
      }
      
      // Escape special regex characters in the placeholder for matching
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Escape special replacement characters ($, &) in the replacement string
      const escapedReplacement = replacement.replace(/\$/g, '$$$$');
      
      rendered = rendered.replace(new RegExp(escapedPlaceholder, 'g'), escapedReplacement);
    }
    
    return rendered;
  }

  /**
   * Reset a template to its default content
   */
  async resetToDefault(managerId: string, type: TemplateType): Promise<MessageTemplate> {
    // Delete custom template if it exists
    await this.repository.deleteByManagerAndType(managerId, type);
    
    // Get the default template
    const defaultTemplate = DEFAULT_TEMPLATES[type];
    
    // Save the default template for this manager
    return this.repository.save({
      managerId,
      type,
      content: defaultTemplate.content,
      requiredVariables: defaultTemplate.requiredVariables,
      isDefault: true
    });
  }

  /**
   * Initialize default templates in the database for a manager
   */
  async initializeDefaultTemplates(managerId: string): Promise<void> {
    for (const [type, template] of Object.entries(DEFAULT_TEMPLATES)) {
      await this.repository.save({
        managerId,
        type: type as TemplateType,
        content: template.content,
        requiredVariables: template.requiredVariables,
        isDefault: true
      });
    }
  }
}
