# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension (Manifest V3) that performs sakura (fake review) checking on Amazon product pages. The extension targets both Amazon Japan (`amazon.co.jp`) and Amazon US (`amazon.com`) sites using sakura-checker.jp as the data source.

## Architecture

- **manifest.json**: Chrome extension configuration with Manifest V3 format
- **content.js**: Content script that runs on Amazon pages, handles ASIN extraction, sakura-checker.jp API calls, and UI display
- **icons/icon16.svg**: Extension icon (16x16 SVG format)
- **package.json**: Minimal package configuration (no build dependencies)

## Installation and Usage

This extension has no build process and runs directly from source:

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode" 
3. Click "Load unpacked extension"
4. Select this project folder
5. Visit Amazon product pages or wishlists to see sakura scores

## Core Functionality

### Product Page Detection
The extension detects Amazon product pages through:
- URL pattern matching (`/dp/` or `/gp/product/`)
- DOM element presence checks (`#productTitle`, price elements, etc.)

### ASIN Extraction
Multiple methods are used to extract Amazon Standard Identification Numbers:
- URL parsing for `/dp/[ASIN]` patterns
- `data-asin` attributes on DOM elements
- Meta tag content analysis

### Sakura Score Integration
- Constructs sakura-checker.jp URLs using extracted product URLs
- Parses HTML responses to extract percentage scores
- Handles both "サクラ度XX%" and "XX%サクラ" text patterns

### UI Display System
- **Product Pages**: Large prominent display with color-coded risk levels
- **Wishlist Pages**: Compact badge display for each item
- **Color Coding**: Red (80%+), Orange (60%+), Yellow (40%+), Green (<40%)
- **Rate Limiting**: 500ms delays between wishlist item requests

## Extension Permissions

- `activeTab`: Access to current Amazon page
- `storage`: Local data persistence  
- `host_permissions`: Access to Amazon domains and sakura-checker.jp

## Technical Notes

- No external dependencies or build tools required
- CORS handled through manifest permissions
- Mutation observer for dynamic page content changes
- Graceful fallback positioning for UI elements