# Chrome Web Store deployment

## Overview

This repository uses GitHub Actions to submit the Chrome extension to the Chrome Web Store when a version bump is pushed to `main`.

## Required setup

### 1. Register the extension in Chrome Web Store

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Create the extension listing and complete the initial manual upload.
3. Copy the extension ID from the dashboard URL.

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
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

## Release flow

1. Update `package.json` to the release version.
2. Run `npm run sync-version` so `manifest.json` uses the same version.
3. Merge the version bump commit into `main`.
4. The `Deploy to Chrome Web Store` workflow runs automatically.
5. If `package.json` version changed in the latest commit, the workflow tests, packages, uploads, and submits the extension for public review.

Pushes to `main` without a `package.json` version change are skipped successfully.

## Notes

- The initial store registration must be done manually.
- The workflow packages only extension runtime files and excludes tests and debug pages.
- Store review itself is handled by Google after the submission is uploaded.
