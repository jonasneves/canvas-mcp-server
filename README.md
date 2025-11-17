# Canvas MCP Server

MCP server that provides Claude Desktop with access to Canvas LMS data through a Chrome extension and native messaging host.

## Overview

This project consists of two components:

1. **Chrome Extension**: Runs in your browser, fetches Canvas data via the Canvas API
2. **Native Host**: Node.js server that communicates with Claude Desktop using the MCP protocol

## Features

- List courses and assignments
- View calendar events and upcoming deadlines
- Access submissions and grades
- Browse course modules
- View course analytics (when available)
- Auto-detect Canvas instance URLs
- Real-time data synchronization

## Prerequisites

- Node.js 16 or higher
- Chrome or Edge browser
- Claude Desktop
- Active Canvas LMS account

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/canvas-mcp-server.git
cd canvas-mcp-server
```

### 2. Install Native Host

```bash
cd native
npm install
npm run install-host
```

This installs the native messaging host manifest for your system.

### 3. Configure Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": [
        "/absolute/path/to/canvas-mcp-server/native/host.js"
      ]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path to your installation.

### 4. Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this repository

### 5. Configure Canvas URL

1. Click the Canvas MCP extension icon in Chrome
2. Enter your Canvas instance URL (e.g., `https://canvas.instructure.com`)
3. Or click "Auto-Detect" to find it from open tabs
4. Click "Save"

### 6. Sync Data

1. Navigate to your Canvas instance in Chrome
2. Click the extension icon
3. Click "Refresh Canvas Data"
4. Wait for sync to complete

### 7. Test Connection

In Claude Desktop, ask:
```
What are my Canvas courses?
```

## Available MCP Tools

The server provides the following tools to Claude:

- `list_courses` - Get all active courses
- `get_course_assignments` - Get assignments for a specific course
- `list_all_assignments` - Get all assignments across courses with submission status
- `get_assignment_details` - Get detailed assignment information including rubrics
- `list_calendar_events` - Get calendar events within a date range
- `get_user_submissions` - Get all submissions for a course
- `list_course_modules` - Get course modules and items
- `list_upcoming_events` - Get upcoming assignments and events
- `get_course_analytics` - Get course analytics (if enabled on your Canvas instance)

## Architecture

```
Canvas LMS (Browser)
    |
    | Canvas API
    |
Chrome Extension (content.js)
    |
    | chrome.runtime messages
    |
Extension Background (background.js)
    |
    | HTTP (localhost:8765)
    |
Native Host (host.js)
    |
    | STDIO + MCP Protocol
    |
Claude Desktop
```

## Development

### Project Structure

```
canvas-mcp-server/
├── extension/           # Chrome extension
│   ├── manifest.json   # Extension manifest
│   ├── background.js   # Service worker
│   ├── content.js      # Canvas API integration
│   ├── popup.html      # Extension UI
│   ├── popup.js        # UI logic
│   └── icon*.png       # Extension icons
├── native/             # Native messaging host
│   ├── host.js         # MCP server
│   ├── package.json    # Dependencies
│   └── manifest.json   # Native messaging manifest
└── README.md
```

### Logging

Logs are written to:
- **macOS/Linux**: `~/canvas-mcp-host.log`
- **Windows**: `%USERPROFILE%\canvas-mcp-host.log`

### Security Notes

- The HTTP server only listens on localhost (127.0.0.1)
- Canvas API credentials are handled by the browser's existing session
- No credentials are stored by the extension or native host
- CORS is enabled for localhost communication between extension and host

## Troubleshooting

### Extension not syncing data

1. Verify you're logged into Canvas in Chrome
2. Check that the Canvas URL is correctly configured
3. Look for errors in the extension console (chrome://extensions/ → Details → Inspect views)

### MCP server not connecting

1. Check that the native host is installed: `npm run install-host` in the `native` folder
2. Verify the path in `claude_desktop_config.json` is correct and absolute
3. Check logs at `~/canvas-mcp-host.log`
4. Restart Claude Desktop after configuration changes

### Canvas API rate limiting

Canvas may rate limit API requests. The extension fetches up to 10 pages per request and caches data. If you hit rate limits, wait a few minutes before syncing again.

### Analytics not available

The `get_course_analytics` tool requires analytics to be enabled on your Canvas instance. Not all institutions enable this feature.

## Configuration

### Customizing HTTP Port

Edit `native/host.js` and change:

```javascript
const HTTP_PORT = 8765;  // Change to your preferred port
```

Then update the extension's `background.js` to match:

```javascript
const MCP_SERVER_URL = 'http://localhost:8765/canvas-data';
```

## License

MIT

## Contributing

Contributions welcome. Please open an issue before submitting major changes.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review logs at `~/canvas-mcp-host.log`
- Open an issue on GitHub with relevant log excerpts