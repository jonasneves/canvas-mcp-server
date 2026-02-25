# Privacy Policy

**Canvas MCP Server** is a Chrome extension and MCP server that provides your Canvas LMS data to Claude Desktop.

## Data Collection

This extension does **not** collect, transmit, or store any personal data on external servers. All data remains on your local machine.

## How It Works

- The Chrome extension reads Canvas LMS data directly from Canvas pages you visit in your browser.
- This data is sent only to the native host process running locally on your machine (`localhost:8765`).
- The native host makes this data available to Claude Desktop through the MCP protocol.
- No data is ever sent to any third-party servers, including the extension developer.

## Data Storage

- All Canvas data is held in memory by the native host process and is cleared when the process stops.
- Log files may be written to `~/canvas-mcp-host.log` for debugging purposes. These files contain only operational messages, not Canvas content.

## Permissions

The extension requests only the permissions necessary to function:

| Permission | Reason |
|---|---|
| `activeTab` | Read Canvas data from the current tab |
| `tabs` | Detect navigation to Canvas pages |
| `scripting` | Inject the content script on Canvas pages |
| `storage` | Store user settings locally |
| `alarms` | Schedule periodic data refreshes |
| `*://*.instructure.com/*`, `*://*.canvaslms.com/*`, `*://*.edu/*` | Access Canvas LMS domains |

## Contact

For questions or concerns, open an issue at https://github.com/jonasneves/canvas-mcp-server/issues
