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
  apiClient.__testing.reset();
  assert.equal(
    apiClient.buildSourceUrl("B08N5WRWNW"),
    "https://sakura-checker.jp/itemsearch/?word=QjA4TjVXUldOVw=="
  );
});

test("buildDetailUrl creates the Sakura Checker detail URL", () => {
  apiClient.__testing.reset();
  assert.equal(
    apiClient.buildDetailUrl("B08N5WRWNW"),
    "https://sakura-checker.jp/search/B08N5WRWNW/"
  );
});

test("buildAmazonProductUrl creates the canonical Amazon product URL", () => {
  apiClient.__testing.reset();
  assert.equal(
    apiClient.buildAmazonProductUrl("B08N5WRWNW"),
    "https://www.amazon.co.jp/dp/B08N5WRWNW"
  );
});

test("encodeItemSearchWord base64-encodes the ASIN", () => {
  assert.equal(apiClient.encodeItemSearchWord("B091BGMKYS"), "QjA5MUJHTUtZUw==");
});

test("checkSakuraScore caches successful rendered responses", async () => {
  apiClient.__testing.reset();
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
      waitImpl: async () => {},
      randomImpl: () => 0,
    });
    const second = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl,
      waitImpl: async () => {},
      randomImpl: () => 0,
    });

    assert.equal(first.ok, true);
    assert.equal(first.cached, false);
    assert.equal(first.sourceUrl, "https://sakura-checker.jp/search/B08N5WRWNW/");
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
    assert.deepEqual(second.score, first.score);
    assert.deepEqual(second.verdict, first.verdict);
    assert.equal(fetchRenderedScoreCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore ignores malformed cached successes and refetches", async () => {
  apiClient.__testing.reset();
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    await apiClient.__testing.writeCache("B08N5WRWNW", {
      ok: true,
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjA4TjVXUldOVw==",
      score: null,
      verdict: null,
    });

    const result = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl: async () => {
        fetchRenderedScoreCalls += 1;
        return {
          ok: true,
          score: {
            kind: "visual-image",
            images: [{ src: "data:image/png;base64,AAAA", alt: "score" }],
            suffix: "/5",
          },
          verdict: null,
        };
      },
      waitImpl: async () => {},
      randomImpl: () => 0,
    });

    assert.equal(result.ok, true);
    assert.equal(result.cached, false);
    assert.equal(result.score.images.length, 1);
    assert.equal(fetchRenderedScoreCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore returns blocked when rendered extraction is blocked", async () => {
  apiClient.__testing.reset();
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: false,
      code: "blocked",
      message: "Sakura Checker temporarily blocked the request.",
    }),
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
});

test("checkSakuraScore rejects successful responses that do not include a usable score", async () => {
  apiClient.__testing.reset();
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: true,
      score: {
        kind: "visual-image",
        images: [],
        suffix: "/5",
      },
      verdict: null,
    }),
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "parse_error");
});

test("checkSakuraScore accepts text-based itemsearch scores", async () => {
  apiClient.__testing.reset();
  const result = await apiClient.checkSakuraScore({
    asin: "B091BGMKYS",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: true,
      score: {
        kind: "text",
        value: "1.93",
        suffix: "/5",
      },
      verdict: {
        kind: "text-verdict",
        lines: ["危険", "サクラ度 90%"],
      },
    }),
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "text");
  assert.equal(result.score.value, "1.93");
  assert.equal(result.sourceUrl, "https://sakura-checker.jp/search/B091BGMKYS/");
});

test("checkSakuraScore returns not_found when the product is missing", async () => {
  apiClient.__testing.reset();
  const result = await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl: async () => ({
      ok: false,
      code: "not_found",
      message: "The product was not found on Sakura Checker.",
    }),
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_found");
});

test("checkSakuraScore falls back to an Amazon product URL search when itemsearch requires it", async () => {
  apiClient.__testing.reset();
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0BJDY6D1W",
    forceRefresh: true,
    fetchRenderedScoreImpl: async (options) => {
      calls.push(options);

      if (calls.length === 1) {
        return {
          ok: false,
          code: "url_search_required",
          message: "Sakura Checker asked for an Amazon product URL search.",
        };
      }

      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "score" }],
          suffix: "/5",
        },
        verdict: null,
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    asin: "B0BJDY6D1W",
    sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjBCSkRZNkQxVw==",
  });
  assert.deepEqual(calls[1], {
    asin: "B0BJDY6D1W",
    sourceUrl: "https://sakura-checker.jp/search/B0BJDY6D1W/",
    urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0BJDY6D1W",
  });
});

test("checkSakuraScore returns the fallback error when URL-search retry also fails", async () => {
  apiClient.__testing.reset();
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0BJDY6D1W",
    forceRefresh: true,
    fetchRenderedScoreImpl: async (options) => {
      calls.push(options);

      if (calls.length === 1) {
        return {
          ok: false,
          code: "url_search_required",
          message: "Sakura Checker asked for an Amazon product URL search.",
        };
      }

      return {
        ok: false,
        code: "blocked",
        message: "Sakura Checker temporarily blocked the request.",
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
  assert.equal(calls.length, 2);
});

test("checkSakuraScore stops after one fallback when URL-search retry still requires a product URL", async () => {
  apiClient.__testing.reset();
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0BJDY6D1W",
    forceRefresh: true,
    fetchRenderedScoreImpl: async (options) => {
      calls.push(options);

      return {
        ok: false,
        code: "url_search_required",
        message: "Sakura Checker asked for an Amazon product URL search.",
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "url_search_required");
  assert.equal(calls.length, 2);
});

test("checkSakuraScore deduplicates concurrent requests for the same ASIN", async () => {
  apiClient.__testing.reset();
  let fetchRenderedScoreCalls = 0;
  let resolveRequest = null;

  const fetchRenderedScoreImpl = async () => {
    fetchRenderedScoreCalls += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };

  const firstPromise = apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });
  const secondPromise = apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchRenderedScoreCalls, 1);

  resolveRequest({
    ok: true,
    score: {
      kind: "visual-image",
      images: [{ src: "data:image/png;base64,AAAA", alt: "score" }],
      suffix: "/5",
    },
    verdict: null,
  });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.deepEqual(second.score, first.score);
});

test("checkSakuraScore serializes concurrent requests for different ASINs", async () => {
  apiClient.__testing.reset();
  const startedAsins = [];
  const resolvers = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;

  const fetchRenderedScoreImpl = async ({ asin }) => {
    startedAsins.push(asin);
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

    return new Promise((resolve) => {
      resolvers.push(() => {
        activeRequests -= 1;
        resolve({
          ok: true,
          score: {
            kind: "visual-image",
            images: [{ src: `data:image/png;base64,${asin}`, alt: asin }],
            suffix: "/5",
          },
          verdict: null,
        });
      });
    });
  };

  const firstPromise = apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });
  const secondPromise = apiClient.checkSakuraScore({
    asin: "B08SECOND0",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(startedAsins, ["B08N5WRWNW"]);
  assert.equal(maxActiveRequests, 1);
  assert.equal(resolvers.length, 1);

  resolvers[0]();

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(startedAsins, ["B08N5WRWNW", "B08SECOND0"]);
  assert.equal(maxActiveRequests, 1);
  assert.equal(resolvers.length, 2);

  resolvers[1]();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.score.images[0].alt, "B08N5WRWNW");
  assert.equal(second.score.images[0].alt, "B08SECOND0");
});

test("checkSakuraScore continues the queue after a request throws", async () => {
  apiClient.__testing.reset();
  const startedAsins = [];

  const fetchRenderedScoreImpl = async ({ asin }) => {
    startedAsins.push(asin);

    if (asin === "B08FIRST00") {
      throw new Error("Simulated Sakura Checker failure.");
    }

    return {
      ok: true,
      score: {
        kind: "visual-image",
        images: [{ src: `data:image/png;base64,${asin}`, alt: asin }],
        suffix: "/5",
      },
      verdict: null,
    };
  };

  const firstPromise = apiClient.checkSakuraScore({
    asin: "B08FIRST00",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });
  const secondPromise = apiClient.checkSakuraScore({
    asin: "B08SECOND0",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(first.ok, false);
  assert.equal(second.ok, true);
  assert.deepEqual(startedAsins, ["B08FIRST00", "B08SECOND0"]);
});

test("checkSakuraScore applies a global request interval between ASINs", async () => {
  apiClient.__testing.reset();
  const waits = [];

  const fetchRenderedScoreImpl = async () => ({
    ok: true,
    score: {
      kind: "visual-image",
      images: [{ src: "data:image/png;base64,AAAA", alt: "score" }],
      suffix: "/5",
    },
    verdict: null,
  });

  await apiClient.checkSakuraScore({
    asin: "B08N5WRWNW",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async (milliseconds) => {
      waits.push(milliseconds);
    },
    randomImpl: () => 0,
  });
  await apiClient.checkSakuraScore({
    asin: "B08SECOND00",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async (milliseconds) => {
      waits.push(milliseconds);
    },
    randomImpl: () => 0,
  });

  assert.ok(waits.length >= 1);
  assert.ok(waits[0] >= 1900);
});
