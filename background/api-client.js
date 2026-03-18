(function (root, factory) {
  const exportsObject = factory(
    root.RenderedScoreClient,
    typeof module !== "undefined" && module.exports
      ? require("./rendered-score-client.js")
      : null
  );
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.ApiClient = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function (workerClient, nodeClient) {
  const RenderedScoreClient = workerClient || nodeClient;
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const CACHE_PREFIX = "score:";

  function buildSourceUrl(asin) {
    return `https://sakura-checker.jp/search/${asin}/`;
  }

  function resolveSakuraUrl(value) {
    if (!value) {
      return value;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (value.startsWith("//")) {
      return `https:${value}`;
    }

    try {
      return new URL(value, "https://sakura-checker.jp").toString();
    } catch {
      return value;
    }
  }

  function normalizeVerdict(verdict) {
    if (!verdict || !verdict.image) {
      return verdict || null;
    }

    return {
      ...verdict,
      image: {
        ...verdict.image,
        src: resolveSakuraUrl(verdict.image.src),
      },
    };
  }

  function createFailure(code, message, sourceUrl) {
    return { ok: false, code, message, sourceUrl };
  }

  function hasStorage() {
    return (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.get === "function"
    );
  }

  function storageGet(key) {
    if (!hasStorage()) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  function storageSet(key, value) {
    if (!hasStorage()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  async function readCache(asin) {
    const cacheKey = `${CACHE_PREFIX}${asin}`;
    const cachedValue = await storageGet(cacheKey);
    if (!cachedValue) {
      return null;
    }

    const fetchedAt = Date.parse(cachedValue.fetchedAt);
    if (Number.isNaN(fetchedAt) || Date.now() - fetchedAt > CACHE_TTL_MS) {
      return null;
    }

    return cachedValue;
  }

  async function writeCache(asin, payload) {
    const cacheKey = `${CACHE_PREFIX}${asin}`;
    await storageSet(cacheKey, payload);
  }

  async function checkSakuraScore({
    asin,
    forceRefresh = false,
    fetchRenderedScoreImpl,
  }) {
    const sourceUrl = buildSourceUrl(asin);

    if (!RenderedScoreClient && typeof fetchRenderedScoreImpl !== "function") {
      return createFailure(
        "parse_error",
        "The rendered score client is not available in the background context.",
        sourceUrl
      );
    }

    if (!forceRefresh) {
      const cachedValue = await readCache(asin);
      if (cachedValue) {
        return { ...cachedValue, cached: true };
      }
    }

    const fetchRenderedScore =
      typeof fetchRenderedScoreImpl === "function"
        ? fetchRenderedScoreImpl
        : RenderedScoreClient.fetchRenderedScore;

    let renderedResult = null;
    try {
      renderedResult = await fetchRenderedScore({
        asin,
        sourceUrl,
      });
    } catch (error) {
      return createFailure(
        "network_error",
        error instanceof Error ? error.message : "Failed to inspect Sakura Checker.",
        sourceUrl
      );
    }

    if (!renderedResult || !renderedResult.ok) {
      return createFailure(
        renderedResult && renderedResult.code ? renderedResult.code : "parse_error",
        renderedResult && renderedResult.message
          ? renderedResult.message
          : "Could not extract a rendered Sakura Checker score.",
        sourceUrl
      );
    }

    const payload = {
      ok: true,
      cached: false,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      score: renderedResult.score,
      verdict: normalizeVerdict(renderedResult.verdict),
    };

    await writeCache(asin, payload);

    return payload;
  }

  return {
    buildSourceUrl,
    checkSakuraScore,
    createFailure,
    readCache,
    writeCache,
  };
});
