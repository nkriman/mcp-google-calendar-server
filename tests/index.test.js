import { jest } from '@jest/globals';
import GoogleCalendarMCPServer from '../src/index.js';

// Mock googleapis and OAuth2Client features if needed

// We'll create a dummy calendar object with events methods
const mockInsert = jest.fn(async () => ({ data: { summary: 'Test', start: { dateTime: 'start' }, end: { dateTime: 'end' }, id: '123', htmlLink: 'link' } }));
const mockList = jest.fn(async () => ({ data: { items: [] } }));
const mockDelete = jest.fn(async () => ({ }));
const mockPatch = jest.fn(async () => ({ data: { summary: 'Updated', start: { dateTime: 'start' }, end: { dateTime: 'end' }, id: '123', htmlLink: 'link' } }));
const mockGet = jest.fn(async () => ({ data: { start: { timeZone: 'UTC' }, end: { timeZone: 'UTC' } } }));

function createServerWithCalendar() {
  const server = new GoogleCalendarMCPServer();
  server.calendar = {
    events: {
      insert: mockInsert,
      list: mockList,
      delete: mockDelete,
      patch: mockPatch,
      get: mockGet
    }
  };
  return server;
}

describe('GoogleCalendarMCPServer handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handleCreateEvent requires authentication if calendar missing', async () => {
    const server = new GoogleCalendarMCPServer();
    server.initializeGoogleAuth = jest.fn().mockResolvedValue(false);
    const result = await server.handleCreateEvent({});
    expect(server.initializeGoogleAuth).toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/Google Calendar not authenticated/);
  });

  test('handleCreateEvent creates event', async () => {
    const server = createServerWithCalendar();
    const result = await server.handleCreateEvent({ summary: 'Test', startDateTime: 'start', endDateTime: 'end' });
    expect(mockInsert).toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/Event created successfully/);
  });

  test('handleListEvents none found', async () => {
    const server = createServerWithCalendar();
    const result = await server.handleListEvents({});
    expect(mockList).toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/No events found/);
  });
});
