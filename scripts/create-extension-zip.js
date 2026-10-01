#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { zipSync } = require("fflate");

const rootDir = path.join(__dirname, "..");
const outputZipPath = path.join(rootDir, "extension.zip");
const packageJsonPath = path.join(rootDir, "package.json");
const manifestJsonPath = path.join(rootDir, "manifest.json");

const entries = [
  { type: "file", relativePath: "manifest.json" },
  { type: "file", relativePath: "background.js" },
  { type: "file", relativePath: "content.js" },
  { type: "file", relativePath: "LICENSE" },
  { type: "directory", relativePath: "background" },
  { type: "directory", relativePath: "content" },
  { type: "directory", relativePath: "icons" },
  { type: "directory", relativePath: "shared" },
];

function normalizeArchivePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function ensureEntriesExist() {
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing required ${entry.type}: ${entry.relativePath}`);
    }
  }
}

function syncManifestVersion() {
  const result = spawnSync(process.execPath, [path.join(__dirname, "sync-version.js")], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("Failed to sync manifest version");
  }
}

function validateSyncedVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, "utf8"));

  if (packageJson.version !== manifestJson.version) {
    throw new Error(
      `Version mismatch after sync: package.json=${packageJson.version}, manifest.json=${manifestJson.version}`
    );
  }
}

function createZip() {
  ensureEntriesExist();
  syncManifestVersion();
  validateSyncedVersion();
  const files = entries.flatMap(({ type, relativePath }) => {
    if (type === "file") {
      return [relativePath];
    }
    return fs.readdirSync(path.join(rootDir, relativePath), { recursive: true })
      .map((file) => path.join(relativePath, file))
      .filter((file) => fs.lstatSync(path.join(rootDir, file)).isFile());
  }).sort();
  const archiveFiles = Object.fromEntries(files.map((file) => [
    normalizeArchivePath(file), fs.readFileSync(path.join(rootDir, file)),
  ]));

  // ponytail: this small extension fits in memory; use streaming if assets grow large.
  // Fixed entry timestamps and sorted paths make packaging independent of checkout mtimes.
  fs.writeFileSync(outputZipPath, zipSync(archiveFiles, {
    level: 9,
    mtime: new Date(1980, 0, 1),
  }));

  console.log(`Created ${outputZipPath}`);
}

try {
  createZip();
} catch (error) {
  console.error(`Failed to create extension zip: ${error.message}`);
  process.exit(1);
}
