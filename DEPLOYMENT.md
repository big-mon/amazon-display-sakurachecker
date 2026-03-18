# Chrome Web Store deployment

## Overview

This repository uses GitHub Actions to submit the Chrome extension to the Chrome Web Store when a version bump is pushed to `main`.

## Required setup

### 1. Register the extension in Chrome Web Store

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Create the extension listing and complete the initial manual upload.
3. Copy the extension ID from the dashboard URL.
4. Copy the publisher ID used by the Chrome Web Store API.

### 2. Create Google API credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project and enable the Chrome Web Store API.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 client ID for a desktop application.
5. Save the client ID and client secret.

### 3. Get a refresh token

1. Open the Google OAuth authorization URL with the Chrome Web Store scope.
2. Sign in with the account that owns the extension.
3. Approve the requested access.
4. Exchange the returned authorization code for a refresh token.

The refresh token is the value used by GitHub Actions.

### 4. Configure GitHub Actions secrets

Add these repository secrets in GitHub: `Settings -> Secrets and variables -> Actions`.

- `CHROME_EXTENSION_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

The workflow now calls the Chrome Web Store API directly so upload failures include the API response body and a `fetchStatus` snapshot in the GitHub Actions log.

## Release flow

1. Update `package.json` to the release version.
2. Run `npm run test:deploy` to execute deterministic tests and the live Sakura Checker smoke tests.
3. Run `npm run zip` to sync `manifest.json` and generate `extension.zip`.
4. Merge the version bump commit into `main`.
5. The `Deploy to Chrome Web Store` workflow runs automatically.
6. If `package.json` version changed in the latest commit, the workflow tests, packages, uploads, and submits the extension for public review.

Pushes to `main` without a `package.json` version change are skipped successfully.

## Test commands

- `npm test`: deterministic parser/API tests only
- `npm run test:live`: live Sakura Checker smoke tests for a small fixed ASIN set via rendered DOM extraction
- `npm run test:e2e-extension`: Playwright Chromium extension smoke test against a real Amazon product page
- `npm run test:deploy`: deterministic tests plus the blocking live smoke tests used by GitHub Actions
- `npm run test:browser-compare`: opt-in browser comparison for local investigation; not part of deployment gating

## Local packaging

Create a Chrome Web Store upload zip locally with:

```bash
npm install
npm run zip
```

The command syncs the manifest version and writes `extension.zip` to the repository root. Upload that zip when you need to submit the extension manually.

## Notes

- The initial store registration must be done manually.
- The workflow packages only extension runtime files and excludes tests and debug pages.
- Store review itself is handled by Google after the submission is uploaded.
