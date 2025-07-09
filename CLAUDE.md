# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension (Manifest V3) that performs sakura (fake review) checking on Amazon product pages. The extension targets both Amazon Japan (`amazon.co.jp`) and Amazon US (`amazon.com`) sites.

## Architecture

- **manifest.json**: Chrome extension configuration with Manifest V3 format
- **content.js**: Content script that runs on Amazon pages (not yet implemented)
- **popup.html**: Extension popup interface (not yet implemented)
- **icons/**: Extension icons directory (not yet implemented)

## Development Commands

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Test (not configured yet)
npm test
```

## Chrome Extension Structure

The extension uses:
- **Content Scripts**: Injected into Amazon pages to analyze product information
- **Popup Interface**: Accessed via extension icon for user interaction
- **Permissions**: `activeTab` and `storage` for page access and data persistence
- **Host Permissions**: Limited to Amazon domains for security

## Key Files to Implement

1. `content.js` - Main content script for Amazon page analysis
2. `popup.html` - Extension popup interface
3. `popup.js` - Popup functionality
4. `icons/` - Extension icons (16x16, 48x48, 128x128)