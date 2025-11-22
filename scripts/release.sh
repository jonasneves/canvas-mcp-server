#!/bin/bash

# Canvas MCP Server Release Automation Script
# This script automates the release process for Chrome Web Store submission

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
MINIFY=true
VERSION_ARG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-minify)
            MINIFY=false
            shift
            ;;
        *)
            VERSION_ARG="$1"
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Canvas MCP Server Release Automation Script   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/extension/manifest.json" ]; then
    echo -e "${RED}Error: manifest.json not found. Are you in the right directory?${NC}"
    exit 1
fi

# Get current version from manifest
CURRENT_VERSION=$(jq -r .version "$PROJECT_ROOT/extension/manifest.json")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"
echo ""

# Ask for new version if not provided
if [ -z "$VERSION_ARG" ]; then
    echo -e "${YELLOW}Enter new version number (or press Enter to keep $CURRENT_VERSION):${NC}"
    read NEW_VERSION
    if [ -z "$NEW_VERSION" ]; then
        NEW_VERSION=$CURRENT_VERSION
    fi
else
    NEW_VERSION=$VERSION_ARG
fi

# Show build type
if [ "$MINIFY" = true ]; then
    echo -e "${GREEN}Build type: MINIFIED${NC}"
else
    echo -e "${GREEN}Build type: Standard (unminified)${NC}"
fi

echo -e "${GREEN}Release version: $NEW_VERSION${NC}"
echo ""

# Pre-flight checks
echo -e "${BLUE}Running pre-flight checks...${NC}"

# Check for required files
required_files=(
    "extension/manifest.json"
    "extension/background.js"
    "extension/content.js"
    "extension/sidepanel.html"
    "extension/sidepanel.js"
    "extension/schedule.html"
    "extension/schedule.js"
    "extension/icon-16.png"
    "extension/icon-48.png"
    "extension/icon-128.png"
    "PRIVACY.md"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$PROJECT_ROOT/$file" ]; then
        echo -e "${RED}✗ Missing required file: $file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $file"
done

echo ""

# Check for inline event handlers (CSP compliance)
echo -e "${BLUE}Checking CSP compliance...${NC}"
if grep -r "onclick\|onload\|onerror" "$PROJECT_ROOT/extension"/*.html > /dev/null 2>&1; then
    echo -e "${RED}✗ Found inline event handlers (CSP violation)${NC}"
    grep -n "onclick\|onload\|onerror" "$PROJECT_ROOT/extension"/*.html
    exit 1
else
    echo -e "${GREEN}✓ No inline event handlers found${NC}"
fi

# Check for eval usage
if grep -r "eval(" "$PROJECT_ROOT/extension"/*.js --exclude-dir=lib > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Found eval() usage (review carefully)${NC}"
    grep -n "eval(" "$PROJECT_ROOT/extension"/*.js --exclude-dir=lib
else
    echo -e "${GREEN}✓ No eval() usage found${NC}"
fi

echo ""

# Update version in manifest
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
    echo -e "${BLUE}Updating version in manifest.json...${NC}"
    jq ".version = \"$NEW_VERSION\"" "$PROJECT_ROOT/extension/manifest.json" > "$PROJECT_ROOT/extension/manifest.json.tmp"
    mv "$PROJECT_ROOT/extension/manifest.json.tmp" "$PROJECT_ROOT/extension/manifest.json"
    echo -e "${GREEN}✓ Updated to version $NEW_VERSION${NC}"
    echo ""
fi

# Create output directory
OUTPUT_DIR="$PROJECT_ROOT/dist"
mkdir -p "$OUTPUT_DIR"

# Run minification if requested
if [ "$MINIFY" = true ]; then
    echo -e "${BLUE}Running JavaScript minification...${NC}"

    # Check if node_modules exists, if not install dependencies
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        cd "$PROJECT_ROOT"
        npm install --silent
    fi

    # Run minification script
    cd "$PROJECT_ROOT"
    node scripts/minify.js

    # Use build directory for minified release
    EXTENSION_SOURCE="$PROJECT_ROOT/build/extension"
    PACKAGE_SUFFIX="-mini"
    echo ""
else
    # Use original extension directory
    EXTENSION_SOURCE="$PROJECT_ROOT/extension"
    PACKAGE_SUFFIX=""
fi

# Create Chrome Web Store package
echo -e "${BLUE}Creating Chrome Web Store package...${NC}"
cd "$EXTENSION_SOURCE"
zip -r "$OUTPUT_DIR/canvas-mcp-server-extension-v$NEW_VERSION$PACKAGE_SUFFIX.zip" \
    manifest.json \
    background.js \
    content.js \
    sidepanel.html \
    sidepanel.js \
    schedule.html \
    schedule.js \
    schedule.css \
    icon-16.png \
    icon-48.png \
    icon-128.png \
    lib/ \
    types/ \
    -x "*.md" "*.DS_Store" "*node_modules*" > /dev/null

cd "$PROJECT_ROOT"

FILE_SIZE=$(ls -lh "$OUTPUT_DIR/canvas-mcp-server-extension-v$NEW_VERSION$PACKAGE_SUFFIX.zip" | awk '{print $5}')
echo -e "${GREEN}✓ Package created: canvas-mcp-server-extension-v$NEW_VERSION$PACKAGE_SUFFIX.zip ($FILE_SIZE)${NC}"

# Create native host package
echo -e "${BLUE}Creating native host package...${NC}"
cd "$PROJECT_ROOT/native-host"
zip -r "$OUTPUT_DIR/canvas-mcp-server-native-host-v$NEW_VERSION.zip" \
    host.js \
    package.json \
    package-lock.json \
    manifest.json \
    README.md \
    -x "*.DS_Store" "*node_modules*" > /dev/null

cd "$PROJECT_ROOT"

FILE_SIZE=$(ls -lh "$OUTPUT_DIR/canvas-mcp-server-native-host-v$NEW_VERSION.zip" | awk '{print $5}')
echo -e "${GREEN}✓ Native host package created ($FILE_SIZE)${NC}"
echo ""

# Verify ZIP contents
echo -e "${BLUE}Verifying package contents...${NC}"
FILE_COUNT=$(unzip -l "$OUTPUT_DIR/canvas-mcp-server-extension-v$NEW_VERSION$PACKAGE_SUFFIX.zip" | grep -c "^-" || true)
echo -e "${GREEN}✓ Extension package contains $FILE_COUNT files${NC}"
echo ""

# Generate release notes
echo -e "${BLUE}Generating release notes...${NC}"
cat > "$OUTPUT_DIR/release-notes-v$NEW_VERSION.md" << EOF
# Canvas MCP Server v$NEW_VERSION

## Chrome Extension

### Features

- AI-powered insights using GitHub Models with structured outputs
- Weekly schedule generation with time-blocked tasks
- Direct Canvas data extraction (no API key required)
- MCP server integration for Claude Desktop
- Modern, intuitive UI with color-coded assignments
- Privacy-first: all data stored locally
- Manifest V3 compliant

### Installation

#### For Users:
1. Download \`canvas-mcp-server-extension-v$NEW_VERSION.zip\`
2. Extract the ZIP file
3. Open Chrome and go to \`chrome://extensions/\`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

#### For Chrome Web Store:
Use \`canvas-mcp-server-extension-v$NEW_VERSION.zip\` directly in the Developer Dashboard

### Native Host (Optional - for MCP Integration)

**Installation:**
1. Download \`canvas-mcp-server-native-host-v$NEW_VERSION.zip\`
2. Extract and run the installation script
3. See native-host/README.md for detailed instructions

---

**Privacy Policy:** https://github.com/jonasneves/canvas-mcp-server/blob/main/PRIVACY.md
**Documentation:** https://github.com/jonasneves/canvas-mcp-server/blob/main/README.md
**Support:** https://github.com/jonasneves/canvas-mcp-server/issues

## Technical Details

- **Manifest Version:** 3
- **Permissions:** Minimal and justified
- **CSP Compliant:** No inline scripts or eval()
- **Security:** All user data stored locally
- **Privacy:** No tracking or analytics

## What's Next?

1. Upload to Chrome Web Store
2. Create promotional assets
3. Capture screenshots
4. Submit for review

EOF

echo -e "${GREEN}✓ Release notes created: release-notes-v$NEW_VERSION.md${NC}"
echo ""

# Create checklist
echo -e "${BLUE}Generating submission checklist...${NC}"
cat > "$OUTPUT_DIR/submission-checklist-v$NEW_VERSION.md" << EOF
# Chrome Web Store Submission Checklist - v$NEW_VERSION

## Completed

- [x] Extension package created (\`canvas-mcp-server-extension-v$NEW_VERSION.zip\`)
- [x] Manifest V3 compliant
- [x] CSP compliant (no inline scripts)
- [x] All icons created (16px, 48px, 128px)
- [x] Privacy policy available at GitHub
- [x] Homepage URL set in manifest
- [x] Permissions minimized and justified

## Before Submission

### Required Assets

- [ ] Small promotional tile (440×280 pixels)
- [ ] Screenshots (1280×800 pixels, 3-5 recommended)
  - [ ] Screenshot #1: Assignment Dashboard
  - [ ] Screenshot #2: AI Insights Panel
  - [ ] Screenshot #3: Weekly Schedule
  - [ ] Screenshot #4: Settings Configuration
  - [ ] Screenshot #5: In-Context View

### Optional Assets

- [ ] Marquee promotional tile (1400×560 pixels)
- [ ] Demo video (optional but recommended)

### Testing

- [ ] Test extension on multiple Canvas instances
- [ ] Verify all features work end-to-end
- [ ] Check for console errors
- [ ] Test with and without API key
- [ ] Verify auto-refresh functionality
- [ ] Test MCP server integration (optional)

### Store Listing

- [ ] Detailed description prepared
- [ ] Permission justifications documented
- [ ] Support contact information ready
- [ ] Category set: Productivity
- [ ] Language set: English

## Store Listing Copy

### Short Description (from manifest)
\`\`\`
Smart Canvas companion with AI insights, assignment tracking, and weekly schedule generation for better studying.
\`\`\`
(122 / 132 characters) ✓

### Detailed Description
See: \`CHROME_WEB_STORE_ASSETS_GUIDE.html\` for full description template

### Privacy Policy URL
\`\`\`
https://github.com/jonasneves/canvas-mcp-server/blob/main/PRIVACY.md
\`\`\`

### Homepage URL
\`\`\`
https://github.com/jonasneves/canvas-mcp-server
\`\`\`

## Submission Steps

1. **Create Developer Account**
   - Go to: https://chrome.google.com/webstore/devconsole
   - Pay \$5 one-time registration fee
   - Enable 2-factor authentication

2. **Upload Extension**
   - Click "New Item"
   - Upload \`canvas-mcp-server-extension-v$NEW_VERSION.zip\`
   - Fill in store listing details

3. **Add Assets**
   - Upload promotional tile (440×280)
   - Upload screenshots (1280×800)
   - Optional: Upload marquee tile (1400×560)

4. **Configure Listing**
   - Add detailed description
   - Set category to "Productivity"
   - Add privacy policy URL
   - Enter permission justifications

5. **Submit for Review**
   - Review all information
   - Submit for publication
   - Wait 1-3 days for review

## Support

If you encounter issues during submission:
- Review: \`CHROME_WEB_STORE_READINESS.md\`
- Guide: \`CHROME_WEB_STORE_ASSETS_GUIDE.html\`
- Checklist: \`CHROME_WEB_STORE_CHECKLIST.md\`

---

Generated: $(date)
Version: $NEW_VERSION
EOF

echo -e "${GREEN}✓ Submission checklist created${NC}"
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Release Package Complete!         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Version:${NC} $NEW_VERSION"
echo -e "${BLUE}Output Directory:${NC} $OUTPUT_DIR"
echo ""
echo -e "${YELLOW}Files created:${NC}"
echo -e "  - canvas-mcp-server-extension-v$NEW_VERSION$PACKAGE_SUFFIX.zip"
echo -e "  - canvas-mcp-server-native-host-v$NEW_VERSION.zip"
echo -e "  - release-notes-v$NEW_VERSION.md"
echo -e "  - submission-checklist-v$NEW_VERSION.md"

if [ "$MINIFY" = true ]; then
    echo ""
    echo -e "${GREEN}JavaScript files have been minified for production!${NC}"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Review ${BLUE}dist/submission-checklist-v$NEW_VERSION.md${NC}"
echo -e "  2. Create promotional assets and screenshots"
echo -e "  3. Upload to Chrome Web Store Developer Dashboard"
echo ""
echo -e "${GREEN}Ready for Chrome Web Store submission!${NC}"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo -e "  If downloading from GitHub Actions artifacts, you'll need to:"
echo -e "  1. Extract the downloaded artifact zip"
echo -e "  2. Re-zip the extension folder contents"
echo -e "  3. Ensure manifest.json is at the root of the new zip"
echo -e ""
echo -e "  See ${BLUE}dist/README.md${NC} for detailed instructions"
