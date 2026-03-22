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
  apiClient.__resetForTests();
  assert.equal(
    apiClient.buildSourceUrl("B08N5WRWNW"),
    "https://sakura-checker.jp/search/B08N5WRWNW/"
  );
});

test("checkSakuraScore caches successful rendered responses", async () => {
  apiClient.__resetForTests();
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

test("checkSakuraScore returns blocked when rendered extraction is blocked", async () => {
  apiClient.__resetForTests();
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

test("checkSakuraScore returns not_found when the product is missing", async () => {
  apiClient.__resetForTests();
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

test("checkSakuraScore deduplicates concurrent requests for the same ASIN", async () => {
  apiClient.__resetForTests();
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
  apiClient.__resetForTests();
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
  apiClient.__resetForTests();
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
  apiClient.__resetForTests();
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
