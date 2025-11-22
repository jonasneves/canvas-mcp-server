# CanvasFlow Native Host

Native messaging host for CanvasFlow that enables MCP (Model Context Protocol) integration with Claude Desktop.

## Overview

This optional component allows Claude Desktop to access your Canvas assignment data through the CanvasFlow Chrome extension. When installed, you can ask Claude about your courses, assignments, and deadlines directly from Claude Desktop.

## Features

- Bidirectional communication between Chrome extension and Claude Desktop
- MCP server implementation for Canvas data access
- Secure native messaging protocol
- Real-time data synchronization

## Architecture

The native host acts as a bridge:

```
Claude Desktop <-> Native Host <-> Chrome Extension <-> Canvas LMS
     (MCP)          (Node.js)      (Native Messaging)
```

## Installation

### Prerequisites

- Node.js 14 or higher
- CanvasFlow Chrome extension installed
- Claude Desktop application (optional, for MCP integration)

### Quick Install

**Download the latest release:**

**Direct download:**
```
https://github.com/jonasneves/canvasflow/releases/download/latest/canvasflow-native-host.zip
```

Or visit [GitHub Releases](https://github.com/jonasneves/canvasflow/releases) to browse all versions.

**Automated Installation:**

**macOS/Linux:**
```bash
unzip canvasflow-native-host.zip
cd canvasflow-native-host
chmod +x install.sh
./install.sh
```

**Windows:**
```cmd
# Extract canvasflow-native-host.zip
cd canvasflow-native-host
install.bat
```

The install script will:
1. Copy files to a permanent location
2. Install Node.js dependencies
3. Configure Chrome native messaging
4. Provide next steps for extension ID configuration

### Manual Installation

1. Download and extract the release package

2. Install dependencies:
   ```bash
   cd canvasflow-native-host
   npm install --production
   ```

3. Install the native messaging host manifest:

   **Windows:**
   ```cmd
   # Run as Administrator or use install.bat
   reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.canvasflow.host" /ve /t REG_SZ /d "%CD%\manifest.json" /f
   ```

   **macOS:**
   ```bash
   mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
   cp manifest.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.canvasflow.host.json
   # Update paths in manifest to absolute paths
   ```

   **Linux:**
   ```bash
   mkdir -p ~/.config/google-chrome/NativeMessagingHosts
   cp manifest.json ~/.config/google-chrome/NativeMessagingHosts/com.canvasflow.host.json
   # Update paths in manifest to absolute paths
   ```

4. Update the manifest with your extension ID:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" and note the CanvasFlow extension ID
   - Edit the installed manifest file and replace `EXTENSION_ID` with your actual ID

5. Restart Chrome

### Verify Installation

1. Open Chrome DevTools console
2. Run: `chrome.runtime.connectNative('com.canvasflow.host')`
3. If successful, the connection will be established without errors

## File Structure

```
native-host/
├── host.js              Native messaging host implementation
├── manifest.json        Native host configuration
├── package.json         Node.js dependencies
└── README.md           This file
```

## Configuration

### manifest.json

Defines the native messaging host configuration:
- Host name: `canvas-mcp-server`
- Entry point: `host.js`
- Allowed origins: CanvasFlow extension ID

### MCP Server

The host implements the Model Context Protocol to expose Canvas data:
- `list_courses`: Get all Canvas courses
- `list_assignments`: Get assignments with filters
- `get_course`: Get detailed course information
- `get_assignment`: Get assignment details

## Development

### Running Locally

```bash
node host.js
```

The host communicates via stdin/stdout using Chrome's native messaging protocol.

### Message Format

Messages are sent as length-prefixed JSON:
1. 4 bytes: message length (uint32, native byte order)
2. N bytes: JSON message

Example:
```json
{
  "action": "getAssignments",
  "timeRange": {
    "weeksBefore": 1,
    "weeksAfter": 1
  }
}
```

### Testing

You can test the native host independently:
```bash
echo '{"action":"ping"}' | node host.js
```

## Security

- Host only accepts connections from the CanvasFlow extension
- All communication is local (no network exposure)
- Canvas data is never stored by the native host
- MCP server runs in isolated process

## Troubleshooting

### Host Not Connecting

1. Verify manifest.json path is absolute
2. Check Chrome's native messaging permissions
3. Ensure Node.js is in system PATH
4. Check Chrome DevTools console for errors

### MCP Server Issues

1. Verify Claude Desktop configuration
2. Check native host logs
3. Ensure extension is running and has Canvas data
4. Test native messaging independently

## Distribution

### GitHub Releases

Automated builds are created via GitHub Actions:
- Windows: Executable with Node.js bundled
- macOS: Universal binary
- Linux: AppImage or tarball

Users can download platform-specific packages from the releases page.

### Manual Installation

For manual installation, users need:
1. Node.js runtime installed
2. Clone or download this directory
3. Run `npm install`
4. Configure native messaging manifest with absolute paths
5. Configure Claude Desktop MCP settings

## Known Limitations

- Requires Chrome extension to be running
- Data synchronization depends on extension refresh
- Native host must be installed separately (not bundled with extension)
- Platform-specific installation steps

## Future Enhancements

- Auto-installer script for all platforms
- Standalone executable (no Node.js required)
- Background sync service
- Multiple browser support (Firefox, Edge)

## Support

For issues or questions, please refer to the main repository.
