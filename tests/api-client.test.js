const test = require("node:test");
const assert = require("node:assert/strict");

const apiClient = require("../background/api-client.js");
const fixtures = require("./fixtures.js");

function installChromeStorageStub() {
  const store = new Map();

  global.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            if (store.has(key)) {
              result[key] = store.get(key);
            }
          }
          callback(result);
        },
        set(entries, callback) {
          for (const [key, value] of Object.entries(entries)) {
            store.set(key, value);
          }
          callback();
        },
      },
    },
  };

  return () => {
    delete global.chrome;
  };
}

test("buildSourceUrl creates the Sakura Checker search URL", () => {
  assert.equal(
    apiClient.buildSourceUrl("B08N5WRWNW"),
    "https://sakura-checker.jp/search/B08N5WRWNW/"
  );
});

test("checkSakuraScore caches successful responses", async () => {
  const cleanup = installChromeStorageStub();
  let fetchCalls = 0;

  try {
    const fetchImpl = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => fixtures.sampleHtml,
      };
    };

    const first = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchImpl,
    });
    const second = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchImpl,
    });

    assert.equal(first.ok, true);
    assert.equal(first.cached, false);
    assert.deepEqual(first.verdict, {
      kind: "visual-verdict",
      image: {
        src: "https://sakura-checker.jp/images/rv_level03.png",
        alt: "判定",
      },
      lines: ["Amazonより", "かなり低いスコア"],
    });
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
    assert.deepEqual(second.verdict, first.verdict);
    assert.equal(fetchCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore returns blocked for rate limited responses", async () => {
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => "",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
});

test("checkSakuraScore returns not_found for missing products", async () => {
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      text: async () => "",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_found");
});
