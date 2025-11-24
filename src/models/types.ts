// Core data model interfaces for Rentema

export interface Property {
  id: string;
  managerId: string;
  address: string;
  rentAmount: number;
  bedrooms: number;
  bathrooms: number;
  availabilityDate: Date;
  isTestMode: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InquiryStatus = 
  | 'new'
  | 'pre_qualifying'
  | 'qualified'
  | 'disqualified'
  | 'video_call_scheduled'
  | 'tour_scheduled'
  | 'completed';

export interface QualificationResult {
  qualified: boolean;
  failedCriteria?: QualificationCriteria[];
}

export interface Inquiry {
  id: string;
  propertyId: string;
  platformId: string;
  externalInquiryId: string;
  prospectiveTenantId: string;
  prospectiveTenantName?: string;
  status: InquiryStatus;
  qualificationResult?: QualificationResult;
  questionSnapshot?: Question[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Response {
  id: string;
  inquiryId: string;
  questionId: string;
  value: any;
  timestamp: Date;
}

export interface PlatformConnection {
  id: string;
  managerId: string;
  platformType: string;
  credentials: Record<string, any>;
  isActive: boolean;
  lastVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ResponseType = 'text' | 'number' | 'boolean' | 'multiple_choice';

export interface Question {
  id: string;
  propertyId: string;
  text: string;
  responseType: ResponseType;
  options?: string[];
  order: number;
  version?: number;
  createdAt: Date;
}

export type QualificationOperator = 'equals' | 'greater_than' | 'less_than' | 'contains';

export interface QualificationCriteria {
  id: string;
  propertyId: string;
  questionId: string;
  operator: QualificationOperator;
  expectedValue: any;
  createdAt: Date;
}

export type AppointmentType = 'video_call' | 'tour';
export type AppointmentStatus = 'scheduled' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  inquiryId: string;
  type: AppointmentType;
  scheduledTime: Date;
  duration: number;
  zoomLink?: string;
  propertyAddress?: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sent' | 'delivered' | 'failed';

export interface Message {
  id: string;
  inquiryId: string;
  direction: MessageDirection;
  content: string;
  status: MessageStatus;
  timestamp: Date;
}

export type TemplateType = 
  | 'pre_qualification_start'
  | 'pre_qualification_question'
  | 'qualification_success'
  | 'qualification_failure'
  | 'video_call_offer'
  | 'video_call_confirmation'
  | 'tour_confirmation'
  | 'reminder_24h'
  | 'reminder_2h';

export interface MessageTemplate {
  id: string;
  managerId: string;
  type: TemplateType;
  content: string;
  requiredVariables: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeBlock {
  startTime: string; // HH:MM format
  endTime: string;
}

export interface WeeklySchedule {
  [day: string]: TimeBlock[];
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AvailabilitySchedule {
  id: string;
  managerId: string;
  scheduleType: 'video_call' | 'tour';
  recurringWeekly: WeeklySchedule;
  blockedDates: DateRange[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InquiryNote {
  id: string;
  inquiryId: string;
  note: string;
  createdBy: string;
  createdAt: Date;
}

export interface PropertyManager {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
