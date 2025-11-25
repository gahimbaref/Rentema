import apiClient from './client';
import type {
  Property,
  PlatformConnection,
  Question,
  QualificationCriteria,
  Inquiry,
  Message,
  Appointment,
  MessageTemplate,
  AvailabilitySchedule,
  InquiryNote,
} from './types';

// Properties API
export const propertiesApi = {
  list: () => apiClient.get<Property[]>('/properties'),
  get: (id: string) => apiClient.get<Property>(`/properties/${id}`),
  create: (data: Partial<Property>) => apiClient.post<Property>('/properties', data),
  update: (id: string, data: Partial<Property>) => apiClient.put<Property>(`/properties/${id}`, data),
  delete: (id: string) => apiClient.delete(`/properties/${id}`),
};

// Platforms API
export const platformsApi = {
  list: () => apiClient.get<PlatformConnection[]>('/platforms'),
  connect: (data: { platformType: string; credentials: any }) => 
    apiClient.post<PlatformConnection>('/platforms', data),
  verify: (id: string) => apiClient.get<{ verified: boolean }>(`/platforms/${id}/verify`),
  disconnect: (id: string) => apiClient.delete(`/platforms/${id}`),
};

// Questions API
export const questionsApi = {
  list: (propertyId: string) => apiClient.get<Question[]>(`/properties/${propertyId}/questions`),
  save: (propertyId: string, questions: Question[]) => 
    apiClient.post(`/properties/${propertyId}/questions`, { questions }),
  update: (propertyId: string, questions: Question[]) => 
    apiClient.put(`/properties/${propertyId}/questions`, { questions }),
};

// Qualification Criteria API
export const criteriaApi = {
  list: (propertyId: string) => apiClient.get<QualificationCriteria[]>(`/properties/${propertyId}/criteria`),
  save: (propertyId: string, criteria: QualificationCriteria[]) => 
    apiClient.post(`/properties/${propertyId}/criteria`, { criteria }),
};

// Inquiries API
export const inquiriesApi = {
  list: (params?: { propertyId?: string; status?: string; startDate?: string; endDate?: string }) => 
    apiClient.get<Inquiry[]>('/inquiries', { params }),
  get: (id: string) => apiClient.get<{ inquiry: Inquiry; messages: Message[] }>(`/inquiries/${id}`),
  override: (id: string, action: { type: string; data?: any }) => 
    apiClient.post(`/inquiries/${id}/override`, action),
  addNote: (id: string, content: string) => 
    apiClient.post<InquiryNote>(`/inquiries/${id}/notes`, { content }),
};

// Scheduling API
export const schedulingApi = {
  setAvailability: (data: AvailabilitySchedule) => apiClient.post('/availability', data),
  getAvailability: () => apiClient.get<AvailabilitySchedule>('/availability'),
  getSlots: (params: { date: string; type: string }) => 
    apiClient.get<string[]>('/availability/slots', { params }),
  scheduleAppointment: (data: Partial<Appointment>) => 
    apiClient.post<Appointment>('/appointments', data),
  cancelAppointment: (id: string) => apiClient.delete(`/appointments/${id}`),
  listAppointments: () => apiClient.get<Appointment[]>('/appointments'),
};

// Templates API
export const templatesApi = {
  list: () => apiClient.get<MessageTemplate[]>('/templates'),
  get: (type: string) => apiClient.get<MessageTemplate>(`/templates/${type}`),
  update: (type: string, content: string) => 
    apiClient.put<MessageTemplate>(`/templates/${type}`, { content }),
  reset: (type: string) => apiClient.post<MessageTemplate>(`/templates/${type}/reset`),
};

// Test Mode API
export const testApi = {
  createTestProperty: (data: Partial<Property>) => 
    apiClient.post<Property>('/test/properties', data),
  simulateInquiry: (data: { propertyId: string; message: string }) => 
    apiClient.post('/test/inquiries', data),
};

export * from './types';
