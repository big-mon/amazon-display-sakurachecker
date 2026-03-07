#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const archiver = require("archiver");

const rootDir = path.join(__dirname, "..");
const outputZipPath = path.join(rootDir, "extension.zip");
const packageJsonPath = path.join(rootDir, "package.json");
const manifestJsonPath = path.join(rootDir, "manifest.json");

const entries = [
  { type: "file", relativePath: "manifest.json" },
  { type: "file", relativePath: "background.js" },
  { type: "file", relativePath: "content.js" },
  { type: "directory", relativePath: "background" },
  { type: "directory", relativePath: "content" },
  { type: "directory", relativePath: "icons" },
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

async function createZip() {
  ensureEntriesExist();
  syncManifestVersion();
  validateSyncedVersion();

  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("warning", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const entry of entries) {
      const absolutePath = path.join(rootDir, entry.relativePath);
      const archivePath = normalizeArchivePath(entry.relativePath);
      if (entry.type === "file") {
        archive.file(absolutePath, { name: archivePath });
      } else {
        archive.directory(absolutePath, archivePath);
      }
    }

    const finalizeResult = archive.finalize();
    if (finalizeResult && typeof finalizeResult.catch === "function") {
      finalizeResult.catch(reject);
    }
  });

  console.log(`Created ${outputZipPath}`);
}

createZip().catch((error) => {
  console.error(`Failed to create extension zip: ${error.message}`);
  process.exit(1);
});
