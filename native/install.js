#!/usr/bin/env node

/**
 * Installation script for Canvas MCP Native Messaging Host
 *
 * This script installs the native messaging host manifest for Chrome/Edge
 * to enable communication between the browser extension and the MCP server.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MANIFEST_NAME = 'com.canvas.mcp.host';
const EXTENSION_ID = 'chrome-extension://your-extension-id-here/';

// Get platform-specific paths
function getManifestPath() {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin':
      return path.join(homeDir, 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
    case 'linux':
      return path.join(homeDir, '.config/google-chrome/NativeMessagingHosts');
    case 'win32':
      // For Windows, we'll use the user-level registry
      return path.join(process.env.APPDATA, 'Google', 'Chrome', 'NativeMessagingHosts');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function createManifest(hostPath) {
  return {
    name: MANIFEST_NAME,
    description: "Canvas MCP Server Native Messaging Host",
    path: hostPath,
    type: "stdio",
    allowed_origins: [
      EXTENSION_ID
    ]
  };
}

function install() {
  try {
    // Get the absolute path to host.js
    const hostPath = path.resolve(__dirname, 'host.js');

    // Verify host.js exists
    if (!fs.existsSync(hostPath)) {
      console.error('Error: host.js not found at', hostPath);
      process.exit(1);
    }

    // Make host.js executable on Unix systems
    if (os.platform() !== 'win32') {
      try {
        fs.chmodSync(hostPath, 0o755);
      } catch (error) {
        console.warn('Warning: Could not make host.js executable:', error.message);
      }
    }

    // Get manifest directory
    const manifestDir = getManifestPath();
    const manifestPath = path.join(manifestDir, `${MANIFEST_NAME}.json`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
      console.log('Created directory:', manifestDir);
    }

    // Create manifest content
    const manifest = createManifest(hostPath);

    // Write manifest file
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('\nCanvas MCP Native Messaging Host installed successfully!\n');
    console.log('Manifest location:', manifestPath);
    console.log('Host location:', hostPath);
    console.log('\nNext steps:');
    console.log('1. Note your Chrome extension ID from chrome://extensions/');
    console.log('2. Update the EXTENSION_ID in this script or the manifest file');
    console.log('3. Configure Claude Desktop with the path to host.js');
    console.log('4. Restart Chrome and Claude Desktop\n');

  } catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
  }
}

// Run installation
if (require.main === module) {
  console.log('Installing Canvas MCP Native Messaging Host...\n');
  install();
}

module.exports = { install, getManifestPath, MANIFEST_NAME };
