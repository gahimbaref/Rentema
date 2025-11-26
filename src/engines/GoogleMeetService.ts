import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

export interface MeetingOptions {
  summary: string;
  startTime: Date;
  duration: number; // in minutes
  timezone?: string;
  description?: string;
  attendeeEmail?: string;
}

export interface Meeting {
  id: string;
  meetLink: string;
  htmlLink: string;
}

export class GoogleMeetService {
  private oauth2Client: OAuth2Client;
  private calendar;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    refreshToken: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Create a Google Calendar event with Google Meet link
   */
  async createMeeting(options: MeetingOptions): Promise<Meeting> {
    try {
      const endTime = new Date(options.startTime.getTime() + options.duration * 60000);

      const event = {
        summary: options.summary,
        description: options.description || '',
        start: {
          dateTime: options.startTime.toISOString(),
          timeZone: options.timezone || 'America/New_York',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: options.timezone || 'America/New_York',
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
        attendees: options.attendeeEmail ? [{ email: options.attendeeEmail }] : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 120 }, // 2 hours before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: event,
        sendUpdates: 'all', // Send email invites to attendees
      });

      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video'
      )?.uri;

      if (!meetLink) {
        throw new Error('Failed to generate Google Meet link');
      }

      logger.info('Google Meet created', {
        eventId: response.data.id,
        summary: options.summary,
        meetLink,
      });

      return {
        id: response.data.id!,
        meetLink,
        htmlLink: response.data.htmlLink!,
      };
    } catch (error: any) {
      logger.error('Failed to create Google Meet', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to create Google Meet: ${error.message}`);
    }
  }

  /**
   * Delete a calendar event (and associated Meet link)
   */
  async deleteMeeting(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all', // Notify attendees of cancellation
      });

      logger.info('Google Meet deleted', { eventId });
    } catch (error: any) {
      logger.error('Failed to delete Google Meet', {
        eventId,
        error: error.message,
      });
      throw new Error('Failed to delete Google Meet');
    }
  }

  /**
   * Get event details
   */
  async getMeeting(eventId: string): Promise<any> {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Google Meet', {
        eventId,
        error: error.message,
      });
      throw new Error('Failed to get Google Meet');
    }
  }

  /**
   * Update an existing meeting
   */
  async updateMeeting(
    eventId: string,
    updates: Partial<MeetingOptions>
  ): Promise<Meeting> {
    try {
      const existingEvent = await this.getMeeting(eventId);

      const updatedEvent: any = {
        ...existingEvent,
      };

      if (updates.summary) {
        updatedEvent.summary = updates.summary;
      }

      if (updates.description) {
        updatedEvent.description = updates.description;
      }

      if (updates.startTime && updates.duration) {
        const endTime = new Date(updates.startTime.getTime() + updates.duration * 60000);
        updatedEvent.start = {
          dateTime: updates.startTime.toISOString(),
          timeZone: updates.timezone || 'America/New_York',
        };
        updatedEvent.end = {
          dateTime: endTime.toISOString(),
          timeZone: updates.timezone || 'America/New_York',
        };
      }

      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updatedEvent,
        sendUpdates: 'all',
      });

      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video'
      )?.uri;

      logger.info('Google Meet updated', {
        eventId: response.data.id,
      });

      return {
        id: response.data.id!,
        meetLink: meetLink || '',
        htmlLink: response.data.htmlLink!,
      };
    } catch (error: any) {
      logger.error('Failed to update Google Meet', {
        eventId,
        error: error.message,
      });
      throw new Error('Failed to update Google Meet');
    }
  }
}
