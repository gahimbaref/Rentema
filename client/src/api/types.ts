// API types matching backend models

export interface Property {
  id: string;
  managerId: string;
  address: string;
  rentAmount: number;
  bedrooms: number;
  bathrooms: number;
  availabilityDate: string;
  isTestMode: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnection {
  id: string;
  managerId: string;
  platformType: string;
  isActive: boolean;
  lastVerified: string;
  createdAt: string;
}

export interface Question {
  id: string;
  propertyId: string;
  text: string;
  responseType: 'text' | 'number' | 'boolean' | 'multiple_choice';
  options?: string[];
  order: number;
}

export interface QualificationCriteria {
  id: string;
  propertyId: string;
  questionId: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  expectedValue: any;
}

export interface Inquiry {
  id: string;
  propertyId: string;
  platformId: string;
  externalInquiryId: string;
  prospectiveTenantId: string;
  prospectiveTenantName?: string;
  status: 'new' | 'pre_qualifying' | 'qualified' | 'disqualified' | 'video_call_scheduled' | 'tour_scheduled' | 'completed';
  qualificationResult?: {
    qualified: boolean;
    failedCriteria?: QualificationCriteria[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  inquiryId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'failed';
}

export interface Appointment {
  id: string;
  inquiryId: string;
  type: 'video_call' | 'tour';
  scheduledTime: string;
  duration: number;
  zoomLink?: string;
  propertyAddress?: string;
  status: string;
}

export interface MessageTemplate {
  type: string;
  content: string;
  requiredVariables: string[];
}

export interface AvailabilitySchedule {
  recurringWeekly: {
    [day: string]: TimeBlock[];
  };
  blockedDates: DateRange[];
  videoCallSchedule?: {
    [day: string]: TimeBlock[];
  };
  tourSchedule?: {
    [day: string]: TimeBlock[];
  };
}

export interface TimeBlock {
  startTime: string;
  endTime: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface InquiryNote {
  id: string;
  inquiryId: string;
  content: string;
  createdAt: string;
}
