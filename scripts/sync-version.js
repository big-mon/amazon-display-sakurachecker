#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const manifestJsonPath = path.join(__dirname, "..", "manifest.json");

function syncVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, "utf8"));

  if (manifestJson.version === packageJson.version) {
    console.log(`Versions already in sync: ${packageJson.version}`);
    return;
  }

  manifestJson.version = packageJson.version;
  fs.writeFileSync(
    manifestJsonPath,
    `${JSON.stringify(manifestJson, null, 2)}\n`,
    "utf8"
  );

  console.log(`Synced manifest.json to version ${packageJson.version}`);
}

syncVersion();
