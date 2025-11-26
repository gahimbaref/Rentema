export interface DefaultTemplate {
  templateType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation';
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  variables: string[];
}

export const defaultEmailTemplates: DefaultTemplate[] = [
  {
    templateType: 'questionnaire',
    subject: 'Quick Questions About {{propertyAddress}}',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi {{tenantName}},</h2>
        
        <p>Thank you for your interest in <strong>{{propertyAddress}}</strong>!</p>
        
        <p>To help us process your application quickly, please take a moment to answer a few questions about your rental needs and qualifications.</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{questionnaireLink}}" 
             style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete Questionnaire
          </a>
        </p>
        
        <p><small>This link will expire on {{expirationDate}}.</small></p>
        
        <p>If you have any questions, feel free to reply to this email.</p>
        
        <p>Best regards,<br>
        {{managerName}}<br>
        {{managerEmail}}<br>
        {{managerPhone}}</p>
      </div>
    `,
    plainTextBody: `Hi {{tenantName}},

Thank you for your interest in {{propertyAddress}}!

To help us process your application quickly, please take a moment to answer a few questions about your rental needs and qualifications.

Complete the questionnaire here: {{questionnaireLink}}

This link will expire on {{expirationDate}}.

If you have any questions, feel free to reply to this email.

Best regards,
{{managerName}}
{{managerEmail}}
{{managerPhone}}`,
    variables: ['tenantName', 'propertyAddress', 'questionnaireLink', 'expirationDate', 'managerName', 'managerEmail', 'managerPhone'],
  },

  {
    templateType: 'qualified_scheduling',
    subject: 'Great News! Schedule Your Video Call for {{propertyAddress}}',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Congratulations {{tenantName}}!</h2>
        
        <p>Based on your responses, you're pre-qualified for <strong>{{propertyAddress}}</strong>!</p>
        
        <p>The next step is to schedule a video call to discuss the property and answer any questions you may have. Please select a time that works best for you:</p>
        
        <div style="margin: 20px 0;">
          {{timeSlots}}
        </div>
        
        <p>Simply click on your preferred time slot to confirm your video call appointment. You'll receive a Zoom link once confirmed.</p>
        
        <p>Looking forward to speaking with you!</p>
        
        <p>Best regards,<br>
        {{managerName}}<br>
        {{managerEmail}}<br>
        {{managerPhone}}</p>
      </div>
    `,
    plainTextBody: `Congratulations {{tenantName}}!

Based on your responses, you're pre-qualified for {{propertyAddress}}!

The next step is to schedule a video call to discuss the property and answer any questions you may have. Please select a time that works best for you:

{{timeSlots}}

Simply click on your preferred time slot to confirm your video call appointment. You'll receive a Zoom link once confirmed.

Looking forward to speaking with you!

Best regards,
{{managerName}}
{{managerEmail}}
{{managerPhone}}`,
    variables: ['tenantName', 'propertyAddress', 'timeSlots', 'managerName', 'managerEmail', 'managerPhone'],
  },
  {
    templateType: 'disqualified_rejection',
    subject: 'Update on Your Application for {{propertyAddress}}',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi {{tenantName}},</h2>
        
        <p>Thank you for your interest in <strong>{{propertyAddress}}</strong>.</p>
        
        <p>After reviewing your application, we've determined that this property may not be the best fit for your current needs.</p>
        
        <p>We encourage you to explore other available properties that might better match your requirements.</p>
        
        <p>Thank you again for considering our property, and we wish you the best in your search!</p>
        
        <p>Best regards,<br>
        {{managerName}}<br>
        {{managerEmail}}<br>
        {{managerPhone}}</p>
      </div>
    `,
    plainTextBody: `Hi {{tenantName}},

Thank you for your interest in {{propertyAddress}}.

After reviewing your application, we've determined that this property may not be the best fit for your current needs.

We encourage you to explore other available properties that might better match your requirements.

Thank you again for considering our property, and we wish you the best in your search!

Best regards,
{{managerName}}
{{managerEmail}}
{{managerPhone}}`,
    variables: ['tenantName', 'propertyAddress', 'managerName', 'managerEmail', 'managerPhone'],
  },
  {
    templateType: 'appointment_confirmation',
    subject: 'Appointment Confirmed for {{propertyAddress}}',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Appointment Confirmed!</h2>
        
        <p>Hi {{tenantName}},</p>
        
        <p>Your appointment for <strong>{{propertyAddress}}</strong> has been confirmed.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Date:</strong> {{appointmentDate}}</p>
          <p><strong>Time:</strong> {{appointmentTime}}</p>
          <p><strong>Duration:</strong> {{appointmentDuration}} minutes</p>
          {{videoCallLink}}
        </div>
        
        <p>We look forward to meeting you!</p>
        
        <p>Best regards,<br>
        {{managerName}}<br>
        {{managerEmail}}<br>
        {{managerPhone}}</p>
      </div>
    `,
    plainTextBody: `Appointment Confirmed!

Hi {{tenantName}},

Your appointment for {{propertyAddress}} has been confirmed.

Date: {{appointmentDate}}
Time: {{appointmentTime}}
Duration: {{appointmentDuration}} minutes
{{videoCallLink}}

We look forward to meeting you!

Best regards,
{{managerName}}
{{managerEmail}}
{{managerPhone}}`,
    variables: ['tenantName', 'propertyAddress', 'appointmentDate', 'appointmentTime', 'appointmentDuration', 'videoCallLink', 'cancellationLink', 'managerName', 'managerEmail', 'managerPhone'],
  },
];
