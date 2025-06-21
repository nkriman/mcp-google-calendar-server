#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class GoogleCalendarMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'google-calendar-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.oauth2Client = null;
    this.calendar = null;
    this.setupToolHandlers();
  }

  async initializeGoogleAuth() {
    try {
      const credentialsPath = path.join(__dirname, '..', 'credentials.json');
      const tokenPath = path.join(__dirname, '..', 'token.json');
      
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      
      this.oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);
      
      try {
        const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
        this.oauth2Client.setCredentials(token);
        
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        return true;
      } catch (error) {
        console.error('No valid token found. Authentication required.');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error.message);
      return false;
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_calendar_event',
          description: 'Create a new event in Google Calendar',
          inputSchema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'Event title/summary'
              },
              description: {
                type: 'string',
                description: 'Event description (optional)'
              },
              startDateTime: {
                type: 'string',
                description: 'Start date and time in ISO format (e.g., 2024-12-25T10:00:00-08:00)'
              },
              endDateTime: {
                type: 'string',
                description: 'End date and time in ISO format (e.g., 2024-12-25T11:00:00-08:00)'
              },
              timeZone: {
                type: 'string',
                description: 'Time zone (e.g., America/Los_Angeles)',
                default: 'UTC'
              },
              attendees: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Array of attendee email addresses (optional)'
              },
              location: {
                type: 'string',
                description: 'Event location (optional)'
              }
            },
            required: ['summary', 'startDateTime', 'endDateTime']
          }
        },
        {
          name: 'authenticate_google_calendar',
          description: 'Generate authentication URL for Google Calendar access',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'save_auth_token',
          description: 'Save the authorization code received from Google OAuth',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The authorization code from the OAuth callback URL'
              }
            },
            required: ['code']
          }
        },
        {
          name: 'list_calendar_events',
          description: 'List upcoming calendar events',
          inputSchema: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'number',
                description: 'Maximum number of events to return (default: 10)',
                default: 10
              },
              timeMin: {
                type: 'string',
                description: 'Lower bound for events (ISO format, default: now)'
              },
              timeMax: {
                type: 'string',
                description: 'Upper bound for events (ISO format)'
              },
              q: {
                type: 'string',
                description: 'Free text search terms to find events'
              }
            },
            additionalProperties: false
          }
        },
        {
          name: 'update_calendar_event',
          description: 'Update an existing calendar event',
          inputSchema: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'The ID of the event to update'
              },
              summary: {
                type: 'string',
                description: 'Event title/summary'
              },
              description: {
                type: 'string',
                description: 'Event description'
              },
              startDateTime: {
                type: 'string',
                description: 'Start date and time in ISO format'
              },
              endDateTime: {
                type: 'string',
                description: 'End date and time in ISO format'
              },
              timeZone: {
                type: 'string',
                description: 'Time zone (e.g., America/Los_Angeles)'
              },
              attendees: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Array of attendee email addresses'
              },
              location: {
                type: 'string',
                description: 'Event location'
              }
            },
            required: ['eventId']
          }
        },
        {
          name: 'delete_calendar_event',
          description: 'Delete a calendar event',
          inputSchema: {
            type: 'object',
            properties: {
              eventId: {
                type: 'string',
                description: 'The ID of the event to delete'
              }
            },
            required: ['eventId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'authenticate_google_calendar':
          return await this.handleAuthentication();
        case 'save_auth_token':
          return await this.handleSaveToken(request.params.arguments);
        case 'create_calendar_event':
          return await this.handleCreateEvent(request.params.arguments);
        case 'list_calendar_events':
          return await this.handleListEvents(request.params.arguments);
        case 'update_calendar_event':
          return await this.handleUpdateEvent(request.params.arguments);
        case 'delete_calendar_event':
          return await this.handleDeleteEvent(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async handleAuthentication() {
    try {
      const credentialsPath = path.join(__dirname, '..', 'credentials.json');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      
      // Use http://localhost as the default redirect URI for MCP servers
      const redirectUri = redirect_uris.find(uri => uri.includes('localhost')) || redirect_uris[0];
      const oauth2Client = new OAuth2Client(client_id, client_secret, redirectUri);
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar']
      });

      return {
        content: [
          {
            type: 'text',
            text: `Please visit this URL to authenticate with Google Calendar:\n\n${authUrl}\n\nAfter authentication, you'll get redirected to a URL like:\nhttp://localhost/?code=YOUR_CODE_HERE&scope=...\n\nCopy the 'code' parameter value and use the 'save_auth_token' tool to save it.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Authentication setup failed: ${error.message}\n\nMake sure you have a credentials.json file from Google Cloud Console.`
          }
        ]
      };
    }
  }

  async handleSaveToken(args) {
    try {
      const credentialsPath = path.join(__dirname, '..', 'credentials.json');
      const tokenPath = path.join(__dirname, '..', 'token.json');
      
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      
      // Use http://localhost as the default redirect URI for MCP servers
      const redirectUri = redirect_uris.find(uri => uri.includes('localhost')) || redirect_uris[0];
      const oauth2Client = new OAuth2Client(client_id, client_secret, redirectUri);
      
      const { tokens } = await oauth2Client.getToken(args.code);
      
      await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
      
      return {
        content: [
          {
            type: 'text',
            text: `Authentication successful! Token saved. You can now use the create_calendar_event tool.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to save token: ${error.message}`
          }
        ]
      };
    }
  }

  async handleCreateEvent(args) {
    if (!this.calendar) {
      const initialized = await this.initializeGoogleAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: 'text',
              text: 'Google Calendar not authenticated. Please run authenticate_google_calendar first.'
            }
          ]
        };
      }
    }

    try {
      const event = {
        summary: args.summary,
        description: args.description || '',
        location: args.location || '',
        start: {
          dateTime: args.startDateTime,
          timeZone: args.timeZone || 'UTC'
        },
        end: {
          dateTime: args.endDateTime,
          timeZone: args.timeZone || 'UTC'
        }
      };

      if (args.attendees && args.attendees.length > 0) {
        event.attendees = args.attendees.map(email => ({ email }));
      }

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event created successfully!\n\nTitle: ${response.data.summary}\nStart: ${response.data.start.dateTime}\nEnd: ${response.data.end.dateTime}\nEvent ID: ${response.data.id}\nEvent Link: ${response.data.htmlLink}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create event: ${error.message}`
          }
        ]
      };
    }
  }

  async handleListEvents(args = {}) {
    if (!this.calendar) {
      const initialized = await this.initializeGoogleAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: 'text',
              text: 'Google Calendar not authenticated. Please run authenticate_google_calendar first.'
            }
          ]
        };
      }
    }

    try {
      const params = {
        calendarId: 'primary',
        maxResults: args.maxResults || 10,
        orderBy: 'startTime',
        singleEvents: true,
        timeMin: args.timeMin || new Date().toISOString()
      };

      if (args.timeMax) params.timeMax = args.timeMax;
      if (args.q) params.q = args.q;

      const response = await this.calendar.events.list(params);
      const events = response.data.items || [];

      if (events.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No events found.'
            }
          ]
        };
      }

      const eventList = events.map(event => {
        const start = event.start.dateTime || event.start.date;
        const end = event.end.dateTime || event.end.date;
        return `• ${event.summary} (${event.id})\n  Start: ${start}\n  End: ${end}\n  Location: ${event.location || 'None'}\n`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${events.length} events:\n\n${eventList}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list events: ${error.message}`
          }
        ]
      };
    }
  }

  async handleUpdateEvent(args) {
    if (!this.calendar) {
      const initialized = await this.initializeGoogleAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: 'text',
              text: 'Google Calendar not authenticated. Please run authenticate_google_calendar first.'
            }
          ]
        };
      }
    }

    try {
      // First get the existing event
      const existingEvent = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: args.eventId
      });

      // Build the update object with only provided fields
      const eventUpdate = {};
      
      if (args.summary !== undefined) eventUpdate.summary = args.summary;
      if (args.description !== undefined) eventUpdate.description = args.description;
      if (args.location !== undefined) eventUpdate.location = args.location;
      
      if (args.startDateTime !== undefined) {
        eventUpdate.start = {
          dateTime: args.startDateTime,
          timeZone: args.timeZone || existingEvent.data.start.timeZone || 'UTC'
        };
      }
      
      if (args.endDateTime !== undefined) {
        eventUpdate.end = {
          dateTime: args.endDateTime,
          timeZone: args.timeZone || existingEvent.data.end.timeZone || 'UTC'
        };
      }

      if (args.attendees !== undefined) {
        eventUpdate.attendees = args.attendees.map(email => ({ email }));
      }

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: args.eventId,
        resource: eventUpdate
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event updated successfully!\n\nTitle: ${response.data.summary}\nStart: ${response.data.start.dateTime}\nEnd: ${response.data.end.dateTime}\nEvent ID: ${response.data.id}\nEvent Link: ${response.data.htmlLink}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to update event: ${error.message}`
          }
        ]
      };
    }
  }

  async handleDeleteEvent(args) {
    if (!this.calendar) {
      const initialized = await this.initializeGoogleAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: 'text',
              text: 'Google Calendar not authenticated. Please run authenticate_google_calendar first.'
            }
          ]
        };
      }
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: args.eventId
      });

      return {
        content: [
          {
            type: 'text',
            text: `Event ${args.eventId} deleted successfully!`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to delete event: ${error.message}`
          }
        ]
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Calendar MCP server running on stdio');
  }
}

const server = new GoogleCalendarMCPServer();
server.run().catch(console.error);