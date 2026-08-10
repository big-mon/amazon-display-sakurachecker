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
3. Configure the OAuth consent screen as **External**, add the Google account that owns the extension under **Test users**, and enable 2-Step Verification on that account as required by the Chrome Web Store.
4. Following the official [Chrome Web Store API authorization guide](https://developer.chrome.com/docs/webstore/using-api), create an OAuth 2.0 client ID for a web application and register `https://developers.google.com/oauthplayground` as an authorized redirect URI.
5. Save the client ID and client secret.

### 3. Get a refresh token

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) and enable **Use your own OAuth credentials**.
2. Enter the client ID and client secret without recording them in this repository or logs.
3. Authorize the `https://www.googleapis.com/auth/chromewebstore` scope with the Google account that owns the extension.
4. Exchange the authorization code for tokens and save the refresh token as a GitHub Actions secret.

Setup is complete when the refresh token is stored without exposing its value and the OAuth Playground can make an authenticated Chrome Web Store API request for the intended publisher and extension.

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
2. Run `npm ci`, then install the required browser with `npx playwright install chromium`.
3. Run `npm run test:deploy` locally; this full release validation is required, and `package.json` defines the current suite.
4. Run `npm run zip` to sync `manifest.json` and generate `extension.zip`.
5. Merge the version bump commit into `main`.
6. The `Deploy to Chrome Web Store` workflow runs automatically.
7. If the pushed `package.json` version differs from the version at the start of the push, the workflow reruns deterministic tests with `npm test`, packages, uploads, and submits the extension for public review.
8. Wait for the workflow to finish. Verify that the workflow and upload/publish step succeeded, confirm the final Chrome Web Store status is submitted or under review, and record the workflow run URL and final status in the release report.

Pushes to `main` without a net `package.json` version change across the pushed commit range are complete only when the workflow reports the explicit successful skip; no store submission is expected.

GitHub-hosted Ubuntu runners cannot execute the Sakura Checker live or extension E2E checks because `sakura-checker.jp` blocks their requests with HTTP 403 (`Service unavailable` / `The request is blocked`). Therefore, the required live and E2E checks remain part of the local `npm run test:deploy` release validation, while GitHub Actions reruns deterministic tests and packaging only. A manually dispatched workflow with `dry_run` enabled validates the hosted deterministic-test and packaging path without uploading to the Chrome Web Store.

## Local packaging

Create a Chrome Web Store upload zip locally with:

```bash
npm ci
npm run zip
```

The command syncs the manifest version and writes `extension.zip` to the repository root. Upload that zip when you need to submit the extension manually.

## Notes

- The initial store registration must be done manually.
- The workflow packages only extension runtime files and excludes tests and debug pages.
- Store review itself is handled by Google after the submission is uploaded.
