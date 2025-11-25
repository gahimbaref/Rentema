/**
 * Property-based tests for Scheduling Engine
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { SchedulingEngine } from '../../src/engines/SchedulingEngine';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';
import { WeeklySchedule } from '../../src/models';

describe('Scheduling Engine Property-Based Tests', () => {
  let pool: Pool;
  let schedulingEngine: SchedulingEngine;
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
    
    schedulingEngine = new SchedulingEngine(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up availability schedules after each test
    await pool.query('DELETE FROM availability_schedules');
  });

  // Arbitraries for generating test data
  const timeBlockArbitrary = fc.record({
    startTime: fc.integer({ min: 8, max: 17 }).chain(hour =>
      fc.constantFrom(0, 15, 30, 45).map(minute =>
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      )
    ),
    endTime: fc.integer({ min: 9, max: 18 }).chain(hour =>
      fc.constantFrom(0, 15, 30, 45).map(minute =>
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      )
    )
  }).filter(block => block.startTime < block.endTime);

  const weeklyScheduleArbitrary: fc.Arbitrary<WeeklySchedule> = fc.record({
    monday: fc.array(timeBlockArbitrary, { maxLength: 3 }),
    tuesday: fc.array(timeBlockArbitrary, { maxLength: 3 }),
    wednesday: fc.array(timeBlockArbitrary, { maxLength: 3 }),
    thursday: fc.array(timeBlockArbitrary, { maxLength: 3 }),
    friday: fc.array(timeBlockArbitrary, { maxLength: 3 }),
    saturday: fc.array(timeBlockArbitrary, { maxLength: 2 }),
    sunday: fc.array(timeBlockArbitrary, { maxLength: 2 })
  });

  const dateRangeArbitrary = fc.record({
    startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    endDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
  }).filter(range => range.startDate <= range.endDate);

  const blockedDatesArbitrary = fc.array(dateRangeArbitrary, { maxLength: 5 });

  /**
   * **Feature: rental-automation, Property 28: Availability schedule persistence**
   * For any valid availability schedule with recurring weekly time blocks,
   * storing it and retrieving it should return matching schedule data
   * **Validates: Requirements 11.1**
   */
  it('Property 28: should persist and retrieve availability schedule correctly', async () => {
    const scheduleTypeArbitrary = fc.constantFrom('video_call' as const, 'tour' as const);

    await fc.assert(
      fc.asyncProperty(
        scheduleTypeArbitrary,
        weeklyScheduleArbitrary,
        blockedDatesArbitrary,
        async (scheduleType, recurringWeekly, blockedDates) => {
          // Clean up before each iteration
          await pool.query('DELETE FROM availability_schedules WHERE manager_id = $1', [testManagerId]);
          
          // Set availability
          await schedulingEngine.setAvailability(
            testManagerId,
            scheduleType,
            recurringWeekly,
            blockedDates
          );
          
          // Retrieve availability
          const retrieved = await schedulingEngine.getAvailability(testManagerId, scheduleType);
          
          // Verify schedule matches
          expect(retrieved).not.toBeNull();
          expect(retrieved!.managerId).toBe(testManagerId);
          expect(retrieved!.scheduleType).toBe(scheduleType);
          
          // Verify recurring weekly schedule
          expect(retrieved!.recurringWeekly).toEqual(recurringWeekly);
          
          // Verify blocked dates (comparing date values)
          expect(retrieved!.blockedDates.length).toBe(blockedDates.length);
          for (let i = 0; i < blockedDates.length; i++) {
            const retrievedRange = retrieved!.blockedDates[i];
            const expectedRange = blockedDates[i];
            expect(new Date(retrievedRange.startDate).toISOString()).toBe(new Date(expectedRange.startDate).toISOString());
            expect(new Date(retrievedRange.endDate).toISOString()).toBe(new Date(expectedRange.endDate).toISOString());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 31: Separate availability schedules**
   * For any property manager with different availability schedules for video calls and tours,
   * generating slots for each appointment type should use its respective schedule
   * **Validates: Requirements 11.5**
   */
  it('Property 31: should maintain separate schedules for video calls and tours', async () => {
    await fc.assert(
      fc.asyncProperty(
        weeklyScheduleArbitrary,
        weeklyScheduleArbitrary,
        blockedDatesArbitrary,
        blockedDatesArbitrary,
        async (videoCallSchedule, tourSchedule, videoCallBlocked, tourBlocked) => {
          // Clean up before each iteration
          await pool.query('DELETE FROM availability_schedules WHERE manager_id = $1', [testManagerId]);
          
          // Set different schedules for video calls and tours
          await schedulingEngine.setAvailability(
            testManagerId,
            'video_call',
            videoCallSchedule,
            videoCallBlocked
          );
          
          await schedulingEngine.setAvailability(
            testManagerId,
            'tour',
            tourSchedule,
            tourBlocked
          );
          
          // Retrieve both schedules
          const retrievedVideoCall = await schedulingEngine.getAvailability(testManagerId, 'video_call');
          const retrievedTour = await schedulingEngine.getAvailability(testManagerId, 'tour');
          
          // Verify both schedules exist and are independent
          expect(retrievedVideoCall).not.toBeNull();
          expect(retrievedTour).not.toBeNull();
          
          expect(retrievedVideoCall!.scheduleType).toBe('video_call');
          expect(retrievedTour!.scheduleType).toBe('tour');
          
          // Verify video call schedule matches
          expect(retrievedVideoCall!.recurringWeekly).toEqual(videoCallSchedule);
          
          // Verify tour schedule matches
          expect(retrievedTour!.recurringWeekly).toEqual(tourSchedule);
          
          // Verify they are different objects (not the same schedule)
          expect(retrievedVideoCall!.id).not.toBe(retrievedTour!.id);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 17: Available slot generation respects availability**
   * For any property manager availability schedule, all generated available time slots
   * should fall within the defined availability periods and exclude blocked dates
   * **Validates: Requirements 7.2, 11.3**
   */
  it('Property 17: should generate slots only within availability windows', async () => {
    await fc.assert(
      fc.asyncProperty(
        weeklyScheduleArbitrary,
        blockedDatesArbitrary,
        fc.date({ min: new Date('2025-12-01'), max: new Date('2026-12-31') }),
        async (recurringWeekly, blockedDates, testDate) => {
          // Set availability
          await schedulingEngine.setAvailability(
            testManagerId,
            'video_call',
            recurringWeekly,
            blockedDates
          );
          
          // Get available slots for the test date
          const slots = await schedulingEngine.getAvailableSlots(
            testManagerId,
            'video_call',
            testDate,
            30
          );
          
          // Get day name for the test date
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[testDate.getDay()];
          const timeBlocks = recurringWeekly[dayName] || [];
          
          // Check if date is blocked
          const dateOnly = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate());
          let isBlocked = false;
          for (const range of blockedDates) {
            const start = new Date(range.startDate);
            const end = new Date(range.endDate);
            const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            if (dateOnly >= startOnly && dateOnly <= endOnly) {
              isBlocked = true;
              break;
            }
          }
          
          // If date is blocked or no time blocks, should return empty
          if (isBlocked || timeBlocks.length === 0) {
            expect(slots.length).toBe(0);
            return true;
          }
          
          // Verify all slots fall within time blocks
          for (const slot of slots) {
            const slotStart = slot.startTime;
            const slotHour = slotStart.getHours();
            const slotMinute = slotStart.getMinutes();
            const slotTimeStr = `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
            
            // Check if slot falls within any time block
            let withinBlock = false;
            for (const block of timeBlocks) {
              if (slotTimeStr >= block.startTime && slotTimeStr < block.endTime) {
                withinBlock = true;
                break;
              }
            }
            
            expect(withinBlock).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 29: Blocked period exclusion**
   * For any availability schedule with blocked dates or times,
   * generated available slots should exclude all blocked periods
   * **Validates: Requirements 11.2**
   */
  it('Property 29: should exclude blocked dates from available slots', async () => {
    await fc.assert(
      fc.asyncProperty(
        weeklyScheduleArbitrary,
        fc.array(dateRangeArbitrary, { minLength: 1, maxLength: 5 }),
        async (recurringWeekly, blockedDates) => {
          // Set availability with blocked dates
          await schedulingEngine.setAvailability(
            testManagerId,
            'video_call',
            recurringWeekly,
            blockedDates
          );
          
          // Test each blocked date
          for (const blockedRange of blockedDates) {
            // Pick a date within the blocked range
            const start = new Date(blockedRange.startDate);
            const end = new Date(blockedRange.endDate);
            const testDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
            
            // Get available slots for the blocked date
            const slots = await schedulingEngine.getAvailableSlots(
              testManagerId,
              'video_call',
              testDate,
              30
            );
            
            // Should return no slots for blocked dates
            expect(slots.length).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 15: Appointment data persistence**
   * For any scheduled video call or tour with details (date, time, type, property),
   * storing it and retrieving it should return all fields with matching values
   * **Validates: Requirements 6.3**
   */
  it('Property 15: should persist and retrieve appointment data correctly', async () => {
    // Create test property and inquiry for appointments
    const testPropertyId = '00000000-0000-0000-0000-000000000002';
    const testPlatformId = '00000000-0000-0000-0000-000000000003';
    
    await pool.query(
      `INSERT INTO properties (id, manager_id, address, rent_amount, bedrooms, bathrooms, availability_date, is_test_mode, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [testPropertyId, testManagerId, '123 Test St', 1000, 2, 1, new Date(), true, false]
    );
    
    await pool.query(
      `INSERT INTO platform_connections (id, manager_id, platform_type, credentials, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [testPlatformId, testManagerId, 'test', '{}', true]
    );

    const appointmentArbitrary = fc.record({
      type: fc.constantFrom('video_call' as const, 'tour' as const),
      scheduledTime: fc.date({ min: new Date('2025-12-01'), max: new Date('2026-12-31') }),
      duration: fc.constantFrom(15, 30, 45, 60),
      propertyAddress: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined })
    });

    await fc.assert(
      fc.asyncProperty(appointmentArbitrary, async (appointmentData) => {
        // Create inquiry for this appointment
        const inquiryResult = await pool.query(
          `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, prospective_tenant_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [testPropertyId, testPlatformId, `ext-${Date.now()}-${Math.random()}`, `tenant-${Date.now()}`, 'qualified']
        );
        const inquiryId = inquiryResult.rows[0].id;
        
        // Schedule appointment
        const created = await schedulingEngine.scheduleAppointment({
          ...appointmentData,
          inquiryId
        });
        
        // Retrieve appointment
        const appointmentRepo = new (await import('../../src/database/repositories')).AppointmentRepository(pool);
        const retrieved = await appointmentRepo.findById(created.id);
        
        // Verify all fields match
        expect(retrieved).not.toBeNull();
        expect(retrieved!.inquiryId).toBe(inquiryId);
        expect(retrieved!.type).toBe(appointmentData.type);
        expect(retrieved!.duration).toBe(appointmentData.duration);
        expect(retrieved!.status).toBe('scheduled');
        
        // Compare scheduled times
        const retrievedTime = new Date(retrieved!.scheduledTime);
        const expectedTime = new Date(appointmentData.scheduledTime);
        expect(retrievedTime.getTime()).toBe(expectedTime.getTime());
        
        if (appointmentData.propertyAddress) {
          expect(retrieved!.propertyAddress).toBe(appointmentData.propertyAddress);
        }
        
        // Clean up
        await pool.query('DELETE FROM appointments WHERE id = $1', [created.id]);
        await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]);
        
        return true;
      }),
      { numRuns: 100 }
    );

    // Clean up test data
    await pool.query('DELETE FROM properties WHERE id = $1', [testPropertyId]);
    await pool.query('DELETE FROM platform_connections WHERE id = $1', [testPlatformId]);
  });

  /**
   * **Feature: rental-automation, Property 16: Double-booking prevention**
   * For any time slot that already has a scheduled appointment,
   * attempting to schedule another appointment at an overlapping time should be prevented
   * **Validates: Requirements 6.5**
   */
  it('Property 16: should prevent double-booking of time slots', async () => {
    // Create test property and inquiry for appointments
    const testPropertyId = '00000000-0000-0000-0000-000000000004';
    const testPlatformId = '00000000-0000-0000-0000-000000000005';
    
    await pool.query(
      `INSERT INTO properties (id, manager_id, address, rent_amount, bedrooms, bathrooms, availability_date, is_test_mode, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [testPropertyId, testManagerId, '456 Test Ave', 1500, 3, 2, new Date(), true, false]
    );
    
    await pool.query(
      `INSERT INTO platform_connections (id, manager_id, platform_type, credentials, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [testPlatformId, testManagerId, 'test', '{}', true]
    );

    const appointmentArbitrary = fc.record({
      scheduledTime: fc.date({ min: new Date('2025-12-01'), max: new Date('2026-12-31') }),
      duration: fc.constantFrom(30, 60)
    });

    await fc.assert(
      fc.asyncProperty(appointmentArbitrary, async (appointmentData) => {
        // Create first inquiry
        const inquiry1Result = await pool.query(
          `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, prospective_tenant_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [testPropertyId, testPlatformId, `ext-1-${Date.now()}-${Math.random()}`, `tenant-1-${Date.now()}`, 'qualified']
        );
        const inquiry1Id = inquiry1Result.rows[0].id;
        
        // Create second inquiry
        const inquiry2Result = await pool.query(
          `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, prospective_tenant_id, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [testPropertyId, testPlatformId, `ext-2-${Date.now()}-${Math.random()}`, `tenant-2-${Date.now()}`, 'qualified']
        );
        const inquiry2Id = inquiry2Result.rows[0].id;
        
        // Schedule first appointment
        const appointment1 = await schedulingEngine.scheduleAppointment({
          inquiryId: inquiry1Id,
          type: 'video_call',
          scheduledTime: appointmentData.scheduledTime,
          duration: appointmentData.duration
        });
        
        // Try to schedule overlapping appointment - should throw error
        let errorThrown = false;
        try {
          await schedulingEngine.scheduleAppointment({
            inquiryId: inquiry2Id,
            type: 'video_call',
            scheduledTime: appointmentData.scheduledTime,
            duration: appointmentData.duration
          });
        } catch (error) {
          errorThrown = true;
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('conflict');
        }
        
        expect(errorThrown).toBe(true);
        
        // Clean up
        await pool.query('DELETE FROM appointments WHERE id = $1', [appointment1.id]);
        await pool.query('DELETE FROM inquiries WHERE id IN ($1, $2)', [inquiry1Id, inquiry2Id]);
        
        return true;
      }),
      { numRuns: 100 }
    );

    // Clean up test data
    await pool.query('DELETE FROM properties WHERE id = $1', [testPropertyId]);
    await pool.query('DELETE FROM platform_connections WHERE id = $1', [testPlatformId]);
  });

  /**
   * **Feature: rental-automation, Property 30: Availability update immediacy**
   * For any updated availability schedule,
   * subsequent slot generation requests should use the updated schedule
   * **Validates: Requirements 11.4**
   */
  it('Property 30: should use updated availability immediately for slot generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        weeklyScheduleArbitrary,
        weeklyScheduleArbitrary,
        fc.date({ min: new Date('2025-12-01'), max: new Date('2026-12-31') }),
        async (initialSchedule, updatedSchedule, testDate) => {
          // Set initial availability
          await schedulingEngine.setAvailability(
            testManagerId,
            'video_call',
            initialSchedule,
            []
          );
          
          // Update availability
          await schedulingEngine.setAvailability(
            testManagerId,
            'video_call',
            updatedSchedule,
            []
          );
          
          // Get slots with updated schedule
          const updatedSlots = await schedulingEngine.getAvailableSlots(
            testManagerId,
            'video_call',
            testDate,
            30
          );
          
          // Get day name for the test date
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[testDate.getDay()];
          const updatedTimeBlocks = updatedSchedule[dayName] || [];
          
          // Verify updated slots match the updated schedule
          if (updatedTimeBlocks.length === 0) {
            expect(updatedSlots.length).toBe(0);
          } else {
            // Verify all updated slots fall within updated time blocks
            for (const slot of updatedSlots) {
              const slotStart = slot.startTime;
              const slotHour = slotStart.getHours();
              const slotMinute = slotStart.getMinutes();
              const slotTimeStr = `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
              
              let withinBlock = false;
              for (const block of updatedTimeBlocks) {
                if (slotTimeStr >= block.startTime && slotTimeStr < block.endTime) {
                  withinBlock = true;
                  break;
                }
              }
              
              expect(withinBlock).toBe(true);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
