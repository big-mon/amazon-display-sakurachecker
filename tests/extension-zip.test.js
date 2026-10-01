const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { unzipSync } = require("fflate");

const rootDir = path.join(__dirname, "..");
const runtimeEntries = [
  "manifest.json", "background.js", "content.js", "LICENSE",
  "background", "content", "icons", "shared",
];

function createFixture(t) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "sakura zip test "));
  t.after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));
  for (const entry of [...runtimeEntries, "package.json"]) {
    fs.cpSync(path.join(rootDir, entry), path.join(fixtureDir, entry), { recursive: true });
  }
  fs.mkdirSync(path.join(fixtureDir, "scripts"));
  for (const file of ["create-extension-zip.js", "sync-version.js"]) {
    fs.copyFileSync(path.join(rootDir, "scripts", file), path.join(fixtureDir, "scripts", file));
  }
  fs.mkdirSync(path.join(fixtureDir, "node_modules"));
  fs.cpSync(path.join(rootDir, "node_modules", "fflate"), path.join(fixtureDir, "node_modules", "fflate"), { recursive: true });
  return fixtureDir;
}

function runPackaging(fixtureDir) {
  return spawnSync(process.execPath, [path.join(fixtureDir, "scripts", "create-extension-zip.js")], {
    cwd: os.tmpdir(),
    encoding: "utf8",
  });
}

test("ZIP includes licensed runtime files, syncs versions, and is reproducible", (t) => {
  const fixtureDir = createFixture(t);
  const manifestPath = path.join(fixtureDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = "0.0.0";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.mkdirSync(path.join(fixtureDir, "background", "nested"));
  fs.writeFileSync(path.join(fixtureDir, "background", "nested", "日本語.js"), "// nested runtime fixture\n");
  fs.writeFileSync(path.join(fixtureDir, "scripts", "excluded.txt"), "must not ship");

  const result = runPackaging(fixtureDir);
  assert.equal(result.status, 0, result.stderr);
  const zipPath = path.join(fixtureDir, "extension.zip");
  const firstZip = fs.readFileSync(zipPath);
  const contents = unzipSync(firstZip);
  const expectedFiles = runtimeEntries.flatMap((entry) => {
    const absolutePath = path.join(fixtureDir, entry);
    return fs.statSync(absolutePath).isFile() ? [entry]
      : fs.readdirSync(absolutePath, { recursive: true })
        .map((file) => path.join(entry, file))
        .filter((file) => fs.statSync(path.join(fixtureDir, file)).isFile());
  });
  assert.deepEqual(Object.keys(contents).sort(), expectedFiles.map((file) => file.split(path.sep).join("/")).sort());
  for (const file of expectedFiles) {
    assert.deepEqual(Buffer.from(contents[file.split(path.sep).join("/")]), fs.readFileSync(path.join(fixtureDir, file)));
    fs.utimesSync(path.join(fixtureDir, file), new Date(2020, 0, 1), new Date(2020, 0, 1));
  }
  assert.equal(JSON.parse(Buffer.from(contents["manifest.json"]).toString()).version,
    JSON.parse(fs.readFileSync(path.join(fixtureDir, "package.json"), "utf8")).version);
  assert.equal(runPackaging(fixtureDir).status, 0);
  assert.deepEqual(fs.readFileSync(zipPath), firstZip);
});

test("ZIP creation fails before replacing an archive when LICENSE is missing", (t) => {
  const fixtureDir = createFixture(t);
  const zipPath = path.join(fixtureDir, "extension.zip");
  fs.writeFileSync(zipPath, "previous archive");
  fs.unlinkSync(path.join(fixtureDir, "LICENSE"));
  const result = runPackaging(fixtureDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required file: LICENSE/);
  assert.equal(fs.readFileSync(zipPath, "utf8"), "previous archive");
});
