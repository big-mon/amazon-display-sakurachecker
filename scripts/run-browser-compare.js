const { spawnSync } = require("node:child_process");

const result = spawnSync(process.execPath, ["--test", "tests/browser-compare.test.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ENABLE_BROWSER_COMPARE: "1",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status === null ? 1 : result.status);
