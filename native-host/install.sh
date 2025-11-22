#!/bin/bash
# CanvasFlow Native Host Installation Script
# Supports macOS and Linux

set -e

echo "CanvasFlow Native Host Installer"
echo "================================="
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=linux;;
    Darwin*)    PLATFORM=macos;;
    *)          echo "Unsupported OS: ${OS}"; exit 1;;
esac

echo "Detected platform: ${PLATFORM}"
echo ""

# Get installation directory
INSTALL_DIR="${HOME}/.canvasflow/native-host"
echo "Installation directory: ${INSTALL_DIR}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 14 or higher from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "Node.js version: ${NODE_VERSION}"
echo ""

# Create installation directory
mkdir -p "${INSTALL_DIR}"

# Copy files
echo "Copying files..."
cp host.js "${INSTALL_DIR}/"
cp manifest.json "${INSTALL_DIR}/"
cp package.json "${INSTALL_DIR}/"
cp package-lock.json "${INSTALL_DIR}/"
cp README.md "${INSTALL_DIR}/"

# Install dependencies
echo "Installing dependencies..."
cd "${INSTALL_DIR}"
npm install --production

# Update manifest with absolute path
echo "Configuring native messaging..."
MANIFEST_FILE="${INSTALL_DIR}/manifest.json"

# Platform-specific manifest installation
if [ "${PLATFORM}" = "macos" ]; then
    NATIVE_MANIFEST_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    mkdir -p "${NATIVE_MANIFEST_DIR}"

    # Create manifest with absolute path
    cat > "${NATIVE_MANIFEST_DIR}/com.canvasflow.host.json" <<EOF
{
  "name": "com.canvasflow.host",
  "description": "CanvasFlow Native Messaging Host",
  "path": "${INSTALL_DIR}/host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID/"
  ]
}
EOF

    echo "Installed to: ${NATIVE_MANIFEST_DIR}/com.canvasflow.host.json"
elif [ "${PLATFORM}" = "linux" ]; then
    NATIVE_MANIFEST_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
    mkdir -p "${NATIVE_MANIFEST_DIR}"

    # Create manifest with absolute path
    cat > "${NATIVE_MANIFEST_DIR}/com.canvasflow.host.json" <<EOF
{
  "name": "com.canvasflow.host",
  "description": "CanvasFlow Native Messaging Host",
  "path": "${INSTALL_DIR}/host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID/"
  ]
}
EOF

    echo "Installed to: ${NATIVE_MANIFEST_DIR}/com.canvasflow.host.json"
fi

echo ""
echo "Installation complete!"
echo ""
echo "================================="
echo "CHROME EXTENSION ID CONFIGURATION"
echo "================================="
echo ""
echo "To complete setup, you need your CanvasFlow extension ID:"
echo ""
echo "  1. Open Chrome and go to: chrome://extensions/"
echo "  2. Enable 'Developer mode' (top right)"
echo "  3. Find 'CanvasFlow' in the list"
echo "  4. Copy the ID (looks like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""

# Prompt for extension ID
read -p "Enter your CanvasFlow extension ID (or press Enter to skip): " EXTENSION_ID

if [ -n "${EXTENSION_ID}" ]; then
    # Update the manifest file with the actual extension ID
    if [ "${PLATFORM}" = "macos" ]; then
        MANIFEST_PATH="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.canvasflow.host.json"
    else
        MANIFEST_PATH="${HOME}/.config/google-chrome/NativeMessagingHosts/com.canvasflow.host.json"
    fi

    # Replace EXTENSION_ID placeholder with actual ID
    if [ -f "${MANIFEST_PATH}" ]; then
        sed -i.bak "s/EXTENSION_ID/${EXTENSION_ID}/g" "${MANIFEST_PATH}"
        rm "${MANIFEST_PATH}.bak"
        echo ""
        echo "✓ Extension ID configured successfully!"
    fi
else
    echo ""
    echo "⚠ Skipped extension ID configuration."
    echo ""
    echo "To configure later, edit this file:"
    if [ "${PLATFORM}" = "macos" ]; then
        echo "  ${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.canvasflow.host.json"
    else
        echo "  ${HOME}/.config/google-chrome/NativeMessagingHosts/com.canvasflow.host.json"
    fi
    echo ""
    echo "Replace 'EXTENSION_ID' with your actual extension ID."
fi

echo ""
echo "================================="
echo "CLAUDE DESKTOP SETUP"
echo "================================="
echo ""
echo "To use this with Claude Desktop, add to your Claude Desktop config:"
echo ""
echo "Location: ${HOME}/.config/claude/mcp.json"
echo ""
echo "Add this entry:"
echo ""
echo '{'
echo '  "canvasflow": {'
echo '    "command": "node",'
echo "    \"args\": [\"${INSTALL_DIR}/host.js\"]"
echo '  }'
echo '}'
echo ""
echo "Then restart Claude Desktop and ask: 'What are my Canvas courses?'"
echo ""
echo "Final steps:"
echo "1. Restart Chrome"
echo "2. Click 'Refresh Canvas Data' in the CanvasFlow extension"
echo "3. Restart Claude Desktop (if using MCP)"
echo ""
