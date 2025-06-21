# MCP Google Calendar Server

A Model Context Protocol (MCP) server for creating Google Calendar events.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get Google Calendar API credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Calendar API
   - Create credentials (OAuth 2.0 Client ID)
   - Download the credentials and save as `credentials.json` in the project root

3. **Authenticate:**
   - Run the server and use the `authenticate_google_calendar` tool to get the auth URL
   - Visit the URL, grant permissions, and get the authorization code
   - Create a `token.json` file with your credentials

4. **Configure Claude Code:**
   Add to your MCP settings:
   ```json
   {
     "mcpServers": {
       "google-calendar": {
         "command": "node",
         "args": ["/Users/krilet/mcp-google-calendar-server/src/index.js"]
       }
     }
   }
   ```

## Usage

The server exposes several tools that mirror the handlers defined in
`src/index.js`.

### `authenticate_google_calendar`
Generate a URL that the user must visit to grant access to their Google
Calendar.

**Example request**
```json
{}
```
The response contains a text message with the URL to open and explains how
to capture the `code` parameter for the `save_auth_token` tool.

### `save_auth_token`
Store the OAuth authorization code received after visiting the authentication
URL.

**Parameters**
- `code` (required): The authorization code from the OAuth callback URL.

**Example request**
```json
{
  "code": "4/AAA..."
}
```
Successful execution returns a text confirmation that the token has been saved.

### `create_calendar_event`
Create a new event in your Google Calendar.

**Parameters**
- `summary` (required): Event title
- `startDateTime` (required): Start time in ISO format
- `endDateTime` (required): End time in ISO format
- `description` (optional): Event description
- `location` (optional): Event location
- `timeZone` (optional): Time zone (defaults to UTC)
- `attendees` (optional): Array of email addresses

**Example request**
```json
{
  "summary": "Team Meeting",
  "startDateTime": "2024-12-25T10:00:00-08:00",
  "endDateTime": "2024-12-25T11:00:00-08:00",
  "description": "Weekly team sync",
  "location": "Conference Room A",
  "attendees": ["colleague@example.com"]
}
```
The tool returns details about the newly created event including its ID and
link.

### `list_calendar_events`
List upcoming calendar events.

**Parameters**
- `maxResults` (optional): Maximum number of events to return (default: 10)
- `timeMin` (optional): Lower bound for events (ISO format, defaults to now)
- `timeMax` (optional): Upper bound for events (ISO format)
- `q` (optional): Free text search query

**Example request**
```json
{
  "maxResults": 5,
  "q": "team"
}
```
Returns a text list of matching events or a message if none are found.

### `update_calendar_event`
Update an existing calendar event.

**Parameters**
- `eventId` (required): The ID of the event to update
- `summary` (optional): New event title
- `description` (optional): Event description
- `startDateTime` (optional): New start time in ISO format
- `endDateTime` (optional): New end time in ISO format
- `timeZone` (optional): Time zone
- `attendees` (optional): Array of email addresses
- `location` (optional): Event location

**Example request**
```json
{
  "eventId": "abc123",
  "summary": "Updated Meeting",
  "startDateTime": "2024-12-26T10:00:00-08:00",
  "endDateTime": "2024-12-26T11:00:00-08:00"
}
```
If successful, a text response describes the updated event details.

### `delete_calendar_event`
Delete a calendar event.

**Parameters**
- `eventId` (required): The ID of the event to delete

**Example request**
```json
{
  "eventId": "abc123"
}
```
The tool responds with text confirming the deletion of the event.
