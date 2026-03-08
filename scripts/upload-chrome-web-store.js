#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://chromewebstore.googleapis.com";
const POLL_INTERVAL_MS = 5000;
const MAX_STATUS_POLLS = 12;

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildItemPath(publisherId, extensionId) {
  return `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
}

function buildApiUrl(itemPath, action, { upload = false } = {}) {
  const baseUrl = upload ? `${API_ROOT}/upload/v2/${itemPath}` : `${API_ROOT}/v2/${itemPath}`;
  const url = new URL(action ? `${baseUrl}:${action}` : baseUrl);
  url.searchParams.set("$.xgafv", "2");
  if (upload) {
    url.searchParams.set("uploadType", "media");
  }
  return url;
}

async function parseResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!text) {
    return { contentType, body: null };
  }

  if (contentType.includes("application/json")) {
    return { contentType, body: JSON.parse(text) };
  }

  try {
    return { contentType, body: JSON.parse(text) };
  } catch {
    return { contentType, body: text };
  }
}

function formatBody(body) {
  if (body === null || body === undefined) {
    return "(empty response)";
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body, null, 2);
}

async function requestJson(label, url, options) {
  const response = await fetch(url, options);
  const parsed = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(`${label} failed: HTTP ${response.status} ${response.statusText}`);
    error.details = {
      label,
      status: response.status,
      statusText: response.statusText,
      contentType: parsed.contentType,
      body: parsed.body,
    };
    throw error;
  }

  return parsed.body;
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await requestJson("OAuth token request", TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response || typeof response.access_token !== "string") {
    throw new Error("OAuth token response did not include an access_token");
  }

  return response.access_token;
}

async function fetchStatus(itemPath, accessToken) {
  const url = buildApiUrl(itemPath, "fetchStatus");

  return requestJson("Fetch status", url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function uploadPackage(itemPath, accessToken, zipPath) {
  const archive = fs.readFileSync(zipPath);
  const url = buildApiUrl(itemPath, "upload", { upload: true });

  return requestJson("Upload package", url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/zip",
      "content-length": String(archive.length),
    },
    body: archive,
  });
}

async function publishItem(itemPath, accessToken) {
  const url = buildApiUrl(itemPath, "publish");

  return requestJson("Publish item", url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      publishType: "DEFAULT_PUBLISH",
      skipReview: false,
    }),
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUploadResult(itemPath, accessToken) {
  for (let attempt = 1; attempt <= MAX_STATUS_POLLS; attempt += 1) {
    const status = await fetchStatus(itemPath, accessToken);
    console.log(`Fetch status attempt ${attempt}/${MAX_STATUS_POLLS}:`);
    console.log(formatBody(status));

    const uploadState = status && status.lastAsyncUploadState;
    if (uploadState === "SUCCEEDED" || uploadState === "FAILED" || uploadState === "NOT_FOUND") {
      return status;
    }

    if (attempt < MAX_STATUS_POLLS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    `Upload status did not settle after ${MAX_STATUS_POLLS} attempts (${(MAX_STATUS_POLLS * POLL_INTERVAL_MS) / 1000}s)`
  );
}

async function logStatusSnapshot(itemPath, accessToken, heading) {
  try {
    const status = await fetchStatus(itemPath, accessToken);
    console.error(`${heading}:`);
    console.error(formatBody(status));
  } catch (statusError) {
    console.error(`${heading} failed: ${statusError.message}`);
    if (statusError.details) {
      console.error(formatBody(statusError.details));
    }
  }
}

async function main() {
  const extensionId = readRequiredEnv("CHROME_EXTENSION_ID");
  const publisherId = readRequiredEnv("CHROME_PUBLISHER_ID");
  const clientId = readRequiredEnv("CHROME_CLIENT_ID");
  const clientSecret = readRequiredEnv("CHROME_CLIENT_SECRET");
  const refreshToken = readRequiredEnv("CHROME_REFRESH_TOKEN");
  const zipPath = path.resolve(process.env.CHROME_EXTENSION_ZIP_PATH || "extension.zip");
  const shouldPublish = (process.env.CHROME_PUBLISH || "true").toLowerCase() !== "false";

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Extension archive not found: ${zipPath}`);
  }

  const itemPath = buildItemPath(publisherId, extensionId);
  let accessToken;

  console.log(`Preparing Chrome Web Store upload for item ${extensionId}`);
  console.log(`Archive: ${zipPath}`);

  try {
    accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    console.log("OAuth access token acquired.");

    const uploadResponse = await uploadPackage(itemPath, accessToken, zipPath);
    console.log("Upload response:");
    console.log(formatBody(uploadResponse));

    let uploadState = uploadResponse && uploadResponse.uploadState;
    if (uploadState === "IN_PROGRESS") {
      const status = await waitForUploadResult(itemPath, accessToken);
      uploadState = status && status.lastAsyncUploadState;
    }

    if (uploadState && uploadState !== "SUCCEEDED") {
      throw new Error(`Upload did not succeed. Final upload state: ${uploadState}`);
    }

    await logStatusSnapshot(itemPath, accessToken, "Status after upload");

    if (!shouldPublish) {
      return;
    }

    const publishResponse = await publishItem(itemPath, accessToken);
    console.log("Publish response:");
    console.log(formatBody(publishResponse));
    await logStatusSnapshot(itemPath, accessToken, "Status after publish");
  } catch (error) {
    console.error(error.message);
    if (error.details) {
      console.error("API error details:");
      console.error(formatBody(error.details));
    }

    if (accessToken) {
      await logStatusSnapshot(itemPath, accessToken, "Status snapshot after failure");
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
