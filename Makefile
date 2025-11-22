.PHONY: help release release-dev package test clean install-deps

# Default target
help:
	@echo "Canvas MCP Server - Build and Release Automation"
	@echo ""
	@echo "Available commands:"
	@echo "  make release       - Create release packages"
	@echo "  make release-dev   - Create unminified release (for debugging)"
	@echo "  make package       - Same as release"
	@echo "  make test          - Verify extension structure"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make install-deps  - Install Node.js dependencies"
	@echo ""
	@echo "Examples:"
	@echo "  make release           # Creates release with current version"
	@echo "  make release-dev       # Creates unminified release for debugging"
	@echo "  VERSION=1.0.1 make release  # Creates release with specific version"

# Create release packages
release:
	@echo "Creating release packages..."
	@if [ -n "$(VERSION)" ]; then \
		./scripts/release.sh $(VERSION); \
	else \
		./scripts/release.sh; \
	fi

# Alias for release
package: release

# Create unminified release packages (for debugging)
release-dev:
	@echo "Creating unminified release packages..."
	@if [ -n "$(VERSION)" ]; then \
		./scripts/release.sh --no-minify $(VERSION); \
	else \
		./scripts/release.sh --no-minify; \
	fi

# Install Node.js dependencies
install-deps:
	@if [ ! -d "node_modules" ]; then \
		echo "Installing dependencies..."; \
		npm install; \
	else \
		echo "Dependencies already installed"; \
	fi
	@cd native-host && if [ ! -d "node_modules" ]; then \
		echo "Installing native-host dependencies..."; \
		npm install; \
	else \
		echo "Native-host dependencies already installed"; \
	fi

# Test extension structure
test:
	@echo "Verifying extension structure..."
	@echo ""
	@echo "Checking manifest..."
	@if [ -f extension/manifest.json ]; then \
		echo "✓ manifest.json exists"; \
		cat extension/manifest.json | jq -r '.version' | xargs -I {} echo "  Version: {}"; \
	else \
		echo "✗ manifest.json not found"; \
		exit 1; \
	fi
	@echo ""
	@echo "Checking icons..."
	@for size in 16 48 128; do \
		if [ -f "extension/icon-$$size.png" ]; then \
			echo "✓ icon-$$size.png exists"; \
		else \
			echo "✗ icon-$$size.png missing"; \
		fi; \
	done
	@echo ""
	@echo "Checking CSP compliance..."
	@if grep -r "onclick\|onload\|onerror" extension/*.html > /dev/null 2>&1; then \
		echo "✗ Found inline event handlers (CSP violation)"; \
		grep -n "onclick\|onload\|onerror" extension/*.html; \
		exit 1; \
	else \
		echo "✓ No inline event handlers"; \
	fi
	@echo ""
	@echo "Checking for eval()..."
	@if grep -r "eval(" extension/*.js > /dev/null 2>&1; then \
		echo "⚠ Found eval() usage"; \
		grep -n "eval(" extension/*.js; \
	else \
		echo "✓ No eval() usage"; \
	fi
	@echo ""
	@echo "Checking native-host..."
	@if [ -f native-host/host.js ]; then \
		echo "✓ host.js exists"; \
	else \
		echo "✗ host.js not found"; \
		exit 1; \
	fi
	@echo ""
	@echo "All checks passed!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@rm -rf build/
	@echo "✓ Cleaned dist/ and build/"
