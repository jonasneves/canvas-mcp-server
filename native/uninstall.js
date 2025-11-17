#!/usr/bin/env node

/**
 * Uninstallation script for Canvas MCP Native Messaging Host
 *
 * This script removes the native messaging host manifest.
 */

const fs = require('fs');
const path = require('path');
const { getManifestPath, MANIFEST_NAME } = require('./install.js');

function uninstall() {
  try {
    const manifestDir = getManifestPath();
    const manifestPath = path.join(manifestDir, `${MANIFEST_NAME}.json`);

    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('Native messaging host manifest removed successfully!');
      console.log('Removed:', manifestPath);
    } else {
      console.log('Native messaging host manifest not found.');
      console.log('Expected location:', manifestPath);
    }

  } catch (error) {
    console.error('Uninstallation failed:', error.message);
    process.exit(1);
  }
}

// Run uninstallation
if (require.main === module) {
  console.log('Uninstalling Canvas MCP Native Messaging Host...\n');
  uninstall();
}

module.exports = { uninstall };
