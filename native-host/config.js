/**
 * Configuration for Canvas MCP Native Host
 *
 * Edit these values to customize the server behavior.
 */

module.exports = {
  // HTTP server port for extension communication
  httpPort: process.env.CANVAS_MCP_PORT || 8765,

  // Log file location
  logFile: process.env.CANVAS_MCP_LOG || null, // null = default (~/.canvas-mcp-host.log)

  // Maximum items to fetch per API endpoint
  maxItemsPerFetch: 200,

  // Maximum pages to fetch (pagination limit)
  maxPagesPerFetch: 10,

  // Enable/disable verbose logging
  verboseLogging: process.env.CANVAS_MCP_VERBOSE === 'true' || false,

  // CORS settings
  cors: {
    allowedOrigins: process.env.CANVAS_MCP_CORS_ORIGINS
      ? process.env.CANVAS_MCP_CORS_ORIGINS.split(',')
      : ['*']
  }
};
