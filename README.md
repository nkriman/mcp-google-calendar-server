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
         "args": ["./src/index.js"]
       }
     }
   }
   ```

## Usage

The server provides two tools:

### `authenticate_google_calendar`
Generates an authentication URL for Google Calendar access.

### `create_calendar_event`
Creates a new event in your Google Calendar.

**Parameters:**
- `summary` (required): Event title
- `startDateTime` (required): Start time in ISO format
- `endDateTime` (required): End time in ISO format  
- `description` (optional): Event description
- `location` (optional): Event location
- `timeZone` (optional): Time zone (defaults to UTC)
- `attendees` (optional): Array of email addresses

**Example:**
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