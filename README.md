# Canvas MCP Server

Connect Claude Desktop to your Canvas LMS data through a Chrome extension and native messaging host.

## Features

- Access courses, assignments, and submissions
- View calendar events and upcoming deadlines
- Browse course modules and analytics
- Auto-detect Canvas instance URLs
- Real-time data synchronization

## Quick Start

### Option 1: Simple Installation (Recommended)

1. **Install Claude Desktop integration:**
   - Download: [`canvas-mcp-server-native-host.dxt`](https://github.com/jonasneves/canvas-mcp-server/releases/download/nightly/canvas-mcp-server-native-host.dxt)
   - Open Claude Desktop → Extensions
   - Drag the `.dxt` file into the extensions area
   - Done!

2. **Install Chrome Extension:**
   - Download: [Latest Extension Release](https://github.com/jonasneves/canvas-mcp-server/releases/latest)
   - Extract `canvasflow-extension-v*.zip`
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" → select extracted folder

3. **Configure:**
   - Click the extension icon in Chrome
   - Enter your Canvas URL or click "Auto-Detect"
   - Click "Refresh Canvas Data"

4. **Test:**
   - Ask Claude Desktop: "What are my Canvas courses?"

### Option 2: Install from Source

```bash
git clone https://github.com/jonasneves/canvas-mcp-server.git
cd canvas-mcp-server

# Install native host
cd native-host
npm install
./install.sh  # or install.bat on Windows

# Load extension from ./extension folder
# Follow Chrome extension steps above
```

## Prerequisites

- Node.js 16 or higher
- Chrome or Edge browser
- Claude Desktop
- Active Canvas LMS account

## Available MCP Tools

- `list_courses` - Get all active courses
- `get_course_assignments` - Get assignments for a specific course
- `list_all_assignments` - Get all assignments with submission status
- `get_assignment_details` - Get detailed assignment info including rubrics
- `list_calendar_events` - Get calendar events within a date range
- `get_user_submissions` - Get all submissions for a course
- `list_course_modules` - Get course modules and items
- `list_upcoming_events` - Get upcoming assignments and events
- `get_course_analytics` - Get course analytics (if enabled)

## Architecture

```
Canvas LMS → Chrome Extension → Native Host → Claude Desktop
           (Canvas API)      (HTTP/localhost)  (MCP/STDIO)
```

The extension runs in your browser, fetches data via Canvas API, and forwards it to the native host which communicates with Claude Desktop using the MCP protocol.

## Project Structure

```
canvas-mcp-server/
├── extension/          # Chrome extension
│   ├── manifest.json
│   ├── background.js   # Service worker
│   ├── content.js      # Canvas API integration
│   └── popup.*         # Extension UI
└── native-host/        # MCP server
    ├── host.js         # Main server
    ├── install.sh      # Unix installer
    └── install.bat     # Windows installer
```

## Troubleshooting

**Extension not syncing:**
- Verify you're logged into Canvas in Chrome
- Check Canvas URL configuration in extension
- Inspect extension console: `chrome://extensions/` → Details → Inspect views

**Claude Desktop not connecting:**
- Check logs: `~/canvas-mcp-host.log` (macOS/Linux) or `%USERPROFILE%\canvas-mcp-host.log` (Windows)
- Restart Claude Desktop after configuration changes
- Verify native host installation ran successfully

**Canvas API rate limiting:**
- Extension caches data to minimize requests
- If rate limited, wait a few minutes before syncing

**Analytics unavailable:**
- The `get_course_analytics` tool requires your Canvas instance to have analytics enabled

## Security

- HTTP server only listens on localhost (127.0.0.1)
- No credentials stored; uses browser's Canvas session
- All data stays local on your machine

## Contributing

Contributions welcome! Please open an issue before submitting major changes.

## License

MIT