(function (root, factory) {
  const exportsObject = factory(
    root.ScoreParser,
    typeof module !== "undefined" && module.exports ? require("./score-parser.js") : null
  );
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.ApiClient = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function (workerParser, nodeParser) {
  const ScoreParser = workerParser || nodeParser;
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 15000;
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

  async function fetchSearchPage(asin, fetchImpl = fetch) {
    const sourceUrl = buildSourceUrl(asin);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetchImpl(sourceUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
        cache: "no-store",
      });

      return { response, sourceUrl };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function checkSakuraScore({ asin, forceRefresh = false, fetchImpl = fetch }) {
    const sourceUrl = buildSourceUrl(asin);

    if (!ScoreParser) {
      return createFailure(
        "parse_error",
        "The score parser is not available in the background context.",
        sourceUrl
      );
    }

    if (!forceRefresh) {
      const cachedValue = await readCache(asin);
      if (cachedValue) {
        return { ...cachedValue, cached: true };
      }
    }

    let responseData = null;
    try {
      responseData = await fetchSearchPage(asin, fetchImpl);
    } catch (error) {
      const message =
        error && error.name === "AbortError"
          ? "Timed out while fetching Sakura Checker."
          : "Failed to fetch Sakura Checker.";
      return createFailure("network_error", message, sourceUrl);
    }

    const { response } = responseData;

    if (response.status === 404) {
      return createFailure("not_found", "The product was not found on Sakura Checker.", sourceUrl);
    }
    if (response.status === 403 || response.status === 429) {
      return createFailure("blocked", "Sakura Checker temporarily blocked the request.", sourceUrl);
    }
    if (!response.ok) {
      return createFailure(
        "network_error",
        `Unexpected response from Sakura Checker: ${response.status}.`,
        sourceUrl
      );
    }

    const html = await response.text();
    const parsed = ScoreParser.parseVisualScore(html, asin);
    if (!parsed.ok) {
      return createFailure(parsed.code, parsed.message, sourceUrl);
    }

    const payload = {
      ok: true,
      cached: false,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      score: parsed.score,
      verdict: normalizeVerdict(parsed.verdict),
    };

    await writeCache(asin, payload);

    return payload;
  }

  return {
    buildSourceUrl,
    checkSakuraScore,
    createFailure,
    fetchSearchPage,
    readCache,
    writeCache,
  };
});
