const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackgroundContext({ apiResult = { ok: true, cached: false } } = {}) {
  const listeners = {};
  const apiCalls = [];

  const context = vm.createContext({
    console,
    importScripts: () => {},
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            listeners.onMessage = listener;
          },
        },
      },
    },
    self: {
      ApiClient: {
        buildDetailUrl(asin) {
          return `https://sakura-checker.jp/search/${asin}/`;
        },
        checkSakuraScore(options) {
          apiCalls.push(options);
          return Promise.resolve(apiResult);
        },
      },
      addEventListener() {},
      skipWaiting() {},
      clients: {
        claim() {
          return Promise.resolve();
        },
      },
    },
  });

  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInContext(source, context, { filename: "background.js" });

  return {
    apiCalls,
    onMessage: listeners.onMessage,
  };
}

test("background forwards forceRefresh requests to ApiClient", async () => {
  const { apiCalls, onMessage } = loadBackgroundContext();
  let responsePayload = null;

  const keepChannelOpen = onMessage(
    {
      action: "checkSakuraScore",
      asin: "B095JGJCC7",
      forceRefresh: true,
    },
    null,
    (payload) => {
      responsePayload = payload;
    }
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(keepChannelOpen, true);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].asin, "B095JGJCC7");
  assert.equal(apiCalls[0].forceRefresh, true);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.cached, false);
});

test("background defaults forceRefresh to false when omitted", async () => {
  const { apiCalls, onMessage } = loadBackgroundContext({
    apiResult: { ok: true, cached: true },
  });
  let responsePayload = null;

  const keepChannelOpen = onMessage(
    {
      action: "checkSakuraScore",
      asin: "B095JGJCC7",
    },
    null,
    (payload) => {
      responsePayload = payload;
    }
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(keepChannelOpen, true);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].asin, "B095JGJCC7");
  assert.equal(apiCalls[0].forceRefresh, false);
  assert.equal(responsePayload.ok, true);
  assert.equal(responsePayload.cached, true);
});

test("background forwards product title and product URL to ApiClient", async () => {
  const { apiCalls, onMessage } = loadBackgroundContext();

  onMessage(
    {
      action: "checkSakuraScore",
      asin: "B095JGJCC7",
      productTitle: "Sample product title",
      productUrl: "https://www.amazon.co.jp/dp/B095JGJCC7",
    },
    null,
    () => {}
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].productTitle, "Sample product title");
  assert.equal(apiCalls[0].productUrl, "https://www.amazon.co.jp/dp/B095JGJCC7");
});
