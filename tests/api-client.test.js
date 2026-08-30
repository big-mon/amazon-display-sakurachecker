const test = require("node:test");
const assert = require("node:assert/strict");

const apiClient = require("../background/api-client.js");

function installChromeStorageStub({ getImpl, setImpl, onLastErrorRead } = {}) {
  const store = new Map();
  let currentOperation = null;
  let runtimeLastError;
  const runtime = {};

  Object.defineProperty(runtime, "lastError", {
    configurable: true,
    get() {
      if (onLastErrorRead) {
        onLastErrorRead(currentOperation);
      }
      return runtimeLastError;
    },
    set(value) {
      runtimeLastError = value;
    },
  });

  global.chrome = {
    runtime,
    storage: {
      local: {
        get(keys, callback) {
          currentOperation = "get";
          try {
            if (getImpl) {
              getImpl({ keys, callback, runtime, store });
              return;
            }

            const result = {};
            for (const key of keys) {
              if (store.has(key)) {
                result[key] = store.get(key);
              }
            }
            callback(result);
          } finally {
            currentOperation = null;
          }
        },
        set(entries, callback) {
          currentOperation = "set";
          try {
            if (setImpl) {
              setImpl({ entries, callback, runtime, store });
              return;
            }

            for (const [key, value] of Object.entries(entries)) {
              store.set(key, value);
            }
            callback();
          } finally {
            currentOperation = null;
          }
        },
      },
    },
  };

  return () => {
    delete global.chrome;
  };
}

test.beforeEach(() => {
  apiClient.__testing.reset();
});

test("checkSakuraScore treats storage get runtime errors as cache misses", async () => {
  let fetchRenderedScoreCalls = 0;
  let getLastErrorReads = 0;
  const cleanup = installChromeStorageStub({
    getImpl: ({ callback, runtime }) => {
      runtime.lastError = { message: "Storage read failed." };
      callback();
      runtime.lastError = undefined;
    },
    onLastErrorRead: (operation) => {
      if (operation === "get") {
        getLastErrorReads += 1;
      }
    },
  });

  try {
    const result = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl: async () => {
        fetchRenderedScoreCalls += 1;
        return {
          ok: true,
          score: {
            kind: "text",
            value: "4.00",
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
    assert.equal(fetchRenderedScoreCalls, 1);
    assert.equal(getLastErrorReads, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore keeps a live success when storage set reports a runtime error", async () => {
  let setLastErrorReads = 0;
  const cleanup = installChromeStorageStub({
    setImpl: ({ callback, runtime }) => {
      runtime.lastError = { message: "Storage write failed." };
      callback();
      runtime.lastError = undefined;
    },
    onLastErrorRead: (operation) => {
      if (operation === "set") {
        setLastErrorReads += 1;
      }
    },
  });

  try {
    const result = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: true,
      fetchRenderedScoreImpl: async () => ({
        ok: true,
        score: {
          kind: "text",
          value: "4.00",
          suffix: "/5",
        },
        verdict: null,
      }),
      waitImpl: async () => {},
      randomImpl: () => 0,
    });

    assert.equal(result.ok, true);
    assert.equal(result.cached, false);
    assert.equal(setLastErrorReads, 1);
  } finally {
    cleanup();
  }
});

test("buildDetailUrl creates the Sakura Checker detail URL", () => {
  assert.equal(
    apiClient.buildDetailUrl("B08N5WRWNW"),
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

test("checkSakuraScore filters unsafe fresh score and verdict images", async () => {
  const cleanup = installChromeStorageStub();

  try {
    const result = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: true,
      fetchRenderedScoreImpl: async () => ({
        ok: true,
        score: {
          kind: "visual-image",
          images: [
            { src: "https://tracker.invalid/pixel.png", alt: "unsafe" },
            { src: "/images/score.png", alt: "safe-relative" },
            { src: "data:image/png;base64,AAAA", alt: "safe-data" },
          ],
          suffix: "/5",
        },
        verdict: {
          kind: "visual-verdict",
          image: {
            src: "https://tracker.invalid/verdict.png",
            alt: "unsafe verdict",
          },
          lines: ["危険", "サクラ度 90%"],
        },
      }),
      waitImpl: async () => {},
      randomImpl: () => 0,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.score, {
      kind: "visual-image",
      images: [
        { src: "https://sakura-checker.jp/images/score.png", alt: "safe-relative" },
        { src: "data:image/png;base64,AAAA", alt: "safe-data" },
      ],
      suffix: "/5",
    });
    assert.deepEqual(result.verdict, {
      kind: "visual-verdict",
      lines: ["危険", "サクラ度 90%"],
    });
    assert.equal(result.verdict.image, undefined);

    const inheritedUnsafeVerdict = Object.assign(
      Object.create({
        image: {
          src: "https://tracker.invalid/inherited-verdict.png",
          alt: "unsafe inherited verdict",
        },
      }),
      {
        kind: "visual-verdict",
        lines: ["継承された危険"],
      }
    );
    const inheritedResult = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: true,
      fetchRenderedScoreImpl: async () => ({
        ok: true,
        score: {
          kind: "text",
          value: "4.00",
          suffix: "/5",
        },
        verdict: inheritedUnsafeVerdict,
      }),
      waitImpl: async () => {},
      randomImpl: () => 0,
    });
    assert.equal(inheritedResult.verdict.image, undefined);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore rejects and does not cache an all-unsafe score", async () => {
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    const fetchRenderedScoreImpl = async () => {
      fetchRenderedScoreCalls += 1;
      if (fetchRenderedScoreCalls === 1) {
        return {
          ok: true,
          score: {
            kind: "visual-image",
            images: [{ src: "https://tracker.invalid/pixel.png", alt: "unsafe" }],
            suffix: "/5",
          },
          verdict: null,
        };
      }

      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "safe" }],
          suffix: "/5",
        },
        verdict: null,
      };
    };

    const first = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: true,
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

    assert.equal(first.ok, false);
    assert.equal(first.code, "parse_error");
    assert.equal(second.ok, true);
    assert.equal(second.cached, false);
    assert.equal(second.score.images[0].src, "data:image/png;base64,AAAA");
    assert.equal(fetchRenderedScoreCalls, 2);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore ignores future-dated cached successes and refetches", async () => {
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    await apiClient.__testing.writeCache("B08N5WRWNW", {
      ok: true,
      fetchedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      sourceUrl: "https://sakura-checker.jp/search/B08N5WRWNW/",
      score: {
        kind: "text",
        value: "1.00",
        suffix: "/5",
      },
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
            kind: "text",
            value: "4.00",
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
    assert.equal(result.score.value, "4.00");
    assert.equal(fetchRenderedScoreCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore ignores malformed cached successes and refetches", async () => {
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

test("checkSakuraScore ignores cached successes with only unsafe score images", async () => {
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    await new Promise((resolve) => {
      global.chrome.storage.local.set(
        {
          "score:B08N5WRWNW": {
            ok: true,
            fetchedAt: new Date().toISOString(),
            sourceUrl: "https://sakura-checker.jp/search/B08N5WRWNW/",
            score: {
              kind: "visual-image",
              images: [{ src: "https://tracker.invalid/pixel.png", alt: "unsafe" }],
              suffix: "/5",
            },
            verdict: null,
          },
        },
        resolve
      );
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
            images: [{ src: "data:image/png;base64,AAAA", alt: "fresh" }],
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
    assert.equal(result.score.images[0].src, "data:image/png;base64,AAAA");
    assert.equal(fetchRenderedScoreCalls, 1);
  } finally {
    cleanup();
  }
});

test("checkSakuraScore normalizes cached score images and removes unsafe verdict images", async () => {
  const cleanup = installChromeStorageStub();
  let fetchRenderedScoreCalls = 0;

  try {
    await apiClient.__testing.writeCache("B08N5WRWNW", {
      ok: true,
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://sakura-checker.jp/search/B08N5WRWNW/",
      score: {
        kind: "visual-image",
        images: [{ src: "/images/score.png", alt: "cached score" }],
        suffix: "/5",
      },
      verdict: {
        kind: "visual-verdict",
        image: {
          src: "https://tracker.invalid/verdict.png",
          alt: "unsafe verdict",
        },
        lines: ["危険", "サクラ度 90%"],
      },
    });

    const result = await apiClient.checkSakuraScore({
      asin: "B08N5WRWNW",
      forceRefresh: false,
      fetchRenderedScoreImpl: async () => {
        fetchRenderedScoreCalls += 1;
        throw new Error("A usable cached result should not refetch.");
      },
      waitImpl: async () => {},
      randomImpl: () => 0,
    });

    assert.equal(result.ok, true);
    assert.equal(result.cached, true);
    assert.deepEqual(result.score.images, [
      { src: "https://sakura-checker.jp/images/score.png", alt: "cached score" },
    ]);
    assert.deepEqual(result.verdict, {
      kind: "visual-verdict",
      lines: ["危険", "サクラ度 90%"],
    });
    assert.equal(fetchRenderedScoreCalls, 0);
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
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
});

test("checkSakuraScore rejects successful responses that do not include a usable score", async () => {
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

test("checkSakuraScore falls back to a product URL search when itemsearch requires it even if a product title is available", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0D5RJ5BDX",
    productUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
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
          kind: "text",
          value: "4.99",
          suffix: "/5",
        },
        verdict: {
          kind: "text-verdict",
          lines: ["合格", "サクラ度 0%"],
        },
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "text");
  assert.equal(result.score.value, "4.99");
  assert.deepEqual(calls, [
    {
      asin: "B0D5RJ5BDX",
      sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjBENVJKNUJEWA==",
    },
    {
      asin: "B0D5RJ5BDX",
      sourceUrl: "https://sakura-checker.jp/search/B0D5RJ5BDX/",
      urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
    },
  ]);
});

test("checkSakuraScore falls back to a product URL search after an itemsearch parse failure", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0D5RJ5BDX",
    productUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
    forceRefresh: true,
    fetchRenderedScoreImpl: async (options) => {
      calls.push(options);

      if (calls.length < 2) {
        return {
          ok: false,
          code: "parse_error",
          message: "Could not extract a rendered Sakura Checker score.",
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
  assert.deepEqual(calls[1], {
    asin: "B0D5RJ5BDX",
    sourceUrl: "https://sakura-checker.jp/search/B0D5RJ5BDX/",
    urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
  });
});

test("checkSakuraScore retries ASIN itemsearch after an ambiguous product URL search", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0FPWXKNCK",
    productUrl: "https://www.amazon.co.jp/dp/B0FPWXKNCK",
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

      if (calls.length === 2) {
        return {
          ok: false,
          code: "parse_error",
          message: "Could not locate the requested product in Sakura Checker results.",
        };
      }

      return {
        ok: true,
        score: {
          kind: "text",
          value: "4.99",
          suffix: "/5",
        },
        verdict: {
          kind: "text-verdict",
          lines: ["蜷域ｼ", "繧ｵ繧ｯ繝ｩ蠎ｦ 0%"],
        },
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "text");
  assert.equal(result.score.value, "4.99");
  assert.deepEqual(calls, [
    {
      asin: "B0FPWXKNCK",
      sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjBGUFdYS05DSw==",
    },
    {
      asin: "B0FPWXKNCK",
      sourceUrl: "https://sakura-checker.jp/search/B0FPWXKNCK/",
      urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0FPWXKNCK",
    },
    {
      asin: "B0FPWXKNCK",
      sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjBGUFdYS05DSw==",
    },
  ]);
});

test("checkSakuraScore prefers a detail page score after product URL search returns only a percent score", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0FPWXKNCK",
    productUrl: "https://www.amazon.co.jp/dp/B0FPWXKNCK",
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

      if (calls.length === 2) {
        return {
          ok: true,
          score: {
            kind: "visual-image",
            images: [{ src: "data:image/png;base64,PERCENT", alt: "9" }],
            suffix: "%",
          },
          verdict: null,
        };
      }

      assert.equal(options.sourceUrl, "https://sakura-checker.jp/search/B0FPWXKNCK/");
      assert.equal(options.urlSearchProductUrl, undefined);
      return {
        ok: true,
        score: {
          kind: "text",
          value: "4.99",
          suffix: "/5",
        },
        verdict: {
          kind: "text-verdict",
          lines: ["蜷域ｼ", "繧ｵ繧ｯ繝ｩ蠎ｦ 9%"],
        },
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "text");
  assert.equal(result.score.value, "4.99");
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(calls.map((call) => call.sourceUrl), [
    "https://sakura-checker.jp/itemsearch/?word=QjBGUFdYS05DSw==",
    "https://sakura-checker.jp/search/B0FPWXKNCK/",
    "https://sakura-checker.jp/search/B0FPWXKNCK/",
  ]);
});

test("checkSakuraScore keeps a percent score when the detail page retry fails", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0MODERN42",
    productUrl: "https://www.amazon.co.jp/dp/B0MODERN42",
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

      if (calls.length === 2) {
        return {
          ok: true,
          score: {
            kind: "visual-image",
            images: [{ src: "data:image/png;base64,PERCENT", alt: "safe" }],
            suffix: "%",
          },
          verdict: null,
        };
      }

      return {
        ok: false,
        code: "parse_error",
        message: "Could not locate a rendered Sakura Checker score.",
      };
    },
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.suffix, "%");
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.sourceUrl), [
    "https://sakura-checker.jp/itemsearch/?word=QjBNT0RFUk40Mg==",
    "https://sakura-checker.jp/search/B0MODERN42/",
    "https://sakura-checker.jp/search/B0MODERN42/",
  ]);
});

test("checkSakuraScore uses the provided product URL when itemsearch parsing fails", async () => {
  const calls = [];

  const result = await apiClient.checkSakuraScore({
    asin: "B0D5RJ5BDX",
    productUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
    forceRefresh: true,
    fetchRenderedScoreImpl: async (options) => {
      calls.push(options);

      if (calls.length === 1) {
        return {
          ok: false,
          code: "parse_error",
          message: "Could not extract a rendered Sakura Checker score.",
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
    asin: "B0D5RJ5BDX",
    sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjBENVJKNUJEWA==",
  });
  assert.deepEqual(calls[1], {
    asin: "B0D5RJ5BDX",
    sourceUrl: "https://sakura-checker.jp/search/B0D5RJ5BDX/",
    urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
  });
});

test("checkSakuraScore returns the fallback error when URL-search retry also fails", async () => {
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

test("checkSakuraScore stops after the ASIN itemsearch retry still requires a product URL", async () => {
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
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.sourceUrl), [
    "https://sakura-checker.jp/itemsearch/?word=QjBCSkRZNkQxVw==",
    "https://sakura-checker.jp/search/B0BJDY6D1W/",
    "https://sakura-checker.jp/itemsearch/?word=QjBCSkRZNkQxVw==",
  ]);
});

test("checkSakuraScore deduplicates concurrent requests for the same ASIN", async () => {
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

test("checkSakuraScore deduplicates concurrent requests for the same ASIN even when product URLs differ and URL fallback is required", async () => {
  const startedRequests = [];
  const resolvers = [];

  const fetchRenderedScoreImpl = async ({ asin, urlSearchProductUrl, sourceUrl }) => {
    startedRequests.push({
      asin,
      urlSearchProductUrl: urlSearchProductUrl || null,
      sourceUrl,
    });

    return new Promise((resolve) => {
      resolvers.push(resolve);
    });
  };

  const firstPromise = apiClient.checkSakuraScore({
    asin: "B0D5RJ5BDX",
    productUrl: "",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });
  const secondPromise = apiClient.checkSakuraScore({
    asin: "B0D5RJ5BDX",
    productUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
    forceRefresh: true,
    fetchRenderedScoreImpl,
    waitImpl: async () => {},
    randomImpl: () => 0,
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolvers.length, 1);
  assert.equal(startedRequests.length, 1);

  resolvers[0]({
    ok: false,
    code: "parse_error",
    message: "Could not extract a rendered Sakura Checker score.",
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolvers.length, 2);
  assert.equal(startedRequests.length, 2);
  assert.equal(
    startedRequests.filter((request) => request.urlSearchProductUrl).length,
    1
  );
  assert.deepEqual(startedRequests[1], {
    asin: "B0D5RJ5BDX",
    urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0D5RJ5BDX",
    sourceUrl: "https://sakura-checker.jp/search/B0D5RJ5BDX/",
  });

  resolvers[1]({
    ok: true,
    score: {
      kind: "text",
      value: "4.99",
      suffix: "/5",
    },
    verdict: null,
  });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(startedRequests.map((request) => request.sourceUrl), [
    "https://sakura-checker.jp/itemsearch/?word=QjBENVJKNUJEWA==",
    "https://sakura-checker.jp/search/B0D5RJ5BDX/",
  ]);
});

test("checkSakuraScore serializes concurrent requests for different ASINs", async () => {
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
