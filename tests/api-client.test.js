const test = require("node:test");
const assert = require("node:assert/strict");

const apiClient = require("../background/api-client.js");

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

test("checkSakuraScore caches successful rendered responses", async () => {
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    const fetchRenderedScoreImpl = async () => {
      fetchRenderedScoreCalls += 1;
      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "score" }],
          suffix: "/5",
        },
        verdict: {
          kind: "visual-verdict",
          image: {
            src: "/images/rv_level03.png",
            alt: "verdict",
          },
          lines: ["line 1", "line 2"],
        },
      };
    };

    const first = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl,
    });
    const second = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl,
    });

    assert.equal(first.ok, true);
    assert.equal(first.cached, false);
    assert.deepEqual(first.verdict, {
      kind: "visual-verdict",
      image: {
        src: "https://sakura-checker.jp/images/rv_level03.png",
        alt: "verdict",
      },
      lines: ["line 1", "line 2"],
    });
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
    assert.deepEqual(second.verdict, first.verdict);
    assert.equal(fetchRenderedScoreCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore returns blocked when rendered extraction is blocked", async () => {
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: false,
      code: "blocked",
      message: "Sakura Checker temporarily blocked the request.",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
});

test("checkSakuraScore returns not_found when the product is missing", async () => {
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: false,
      code: "not_found",
      message: "The product was not found on Sakura Checker.",
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_found");
});
