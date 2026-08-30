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
  const SAKURA_ORIGIN = "https://sakura-checker.jp";
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const CACHE_PREFIX = "score:";
  const MIN_REQUEST_INTERVAL_MS = 2000;
  const MAX_REQUEST_JITTER_MS = 250;
  const BACKUP_ERROR_CODES = new Set([
    "not_found",
    "not_ready",
    "not_available",
    "parse_error",
    "url_search_required",
  ]);

  function encodeItemSearchWord(value) {
    const normalizedValue = String(value || "");
    if (typeof btoa === "function") {
      return btoa(normalizedValue);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalizedValue, "utf8").toString("base64");
    }

    throw new Error("No Base64 encoder is available.");
  }

  function buildSourceUrl(asin) {
    return `https://sakura-checker.jp/itemsearch/?word=${encodeItemSearchWord(asin)}`;
  }

  function buildDetailUrl(asin) {
    return `https://sakura-checker.jp/search/${asin}/`;
  }

  function buildAmazonProductUrl(asin) {
    return `https://www.amazon.co.jp/dp/${encodeURIComponent(String(asin || ""))}`;
  }

  function normalizeSearchWord(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function resolveSakuraImageUrl(value) {
    const rawValue = typeof value === "string" ? value.trim() : "";
    if (!rawValue) {
      return null;
    }

    if (/^data:image\/[^,]+,/i.test(rawValue)) {
      return rawValue;
    }

    if (/^data:/i.test(rawValue)) {
      return null;
    }

    try {
      const resolvedUrl = new URL(rawValue, SAKURA_ORIGIN);
      if (resolvedUrl.protocol !== "https:" || resolvedUrl.origin !== SAKURA_ORIGIN) {
        return null;
      }

      return resolvedUrl.toString();
    } catch {
      return null;
    }
  }

  function normalizeImage(image) {
    if (!image || typeof image !== "object") {
      return null;
    }

    const src = resolveSakuraImageUrl(image.src);
    if (!src) {
      return null;
    }

    return {
      ...image,
      src,
    };
  }

  function normalizeScore(score) {
    if (!score || typeof score !== "object" || score.kind !== "visual-image") {
      return score;
    }

    return {
      ...score,
      images: Array.isArray(score.images)
        ? score.images.map(normalizeImage).filter(Boolean)
        : [],
    };
  }

  function normalizeVerdict(verdict) {
    if (!verdict || typeof verdict !== "object") {
      return verdict || null;
    }

    const { image: _image, ...rest } = verdict;
    const normalizedImage = normalizeImage(verdict.image);
    return normalizedImage ? { ...rest, image: normalizedImage } : rest;
  }

  function normalizeSuccessPayload(payload) {
    if (!payload || typeof payload !== "object" || payload.ok !== true) {
      return payload;
    }

    return {
      ...payload,
      score: normalizeScore(payload.score),
      verdict: normalizeVerdict(payload.verdict),
    };
  }

  function createFailure(code, message, sourceUrl) {
    return { ok: false, code, message, sourceUrl };
  }

  function hasValidScoreImage(image) {
    return Boolean(
      image &&
      typeof image === "object" &&
      typeof image.src === "string" &&
      resolveSakuraImageUrl(image.src)
    );
  }

  function hasValidScorePayload(score) {
    if (!score || typeof score !== "object" || typeof score.suffix !== "string") {
      return false;
    }

    if (score.kind === "visual-image") {
      return Boolean(
        Array.isArray(score.images) &&
        score.images.length > 0 &&
        score.images.every(hasValidScoreImage)
      );
    }

    if (score.kind === "text") {
      return typeof score.value === "string" && score.value.trim().length > 0;
    }

    return false;
  }

  function hasValidSuccessPayload(payload) {
    return Boolean(payload && payload.ok === true && hasValidScorePayload(payload.score));
  }

  function isPercentScorePayload(payload) {
    return Boolean(payload && payload.score && payload.score.suffix === "%");
  }

  function createStorageAdapter() {
    function hasStorage() {
      return (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local &&
        typeof chrome.storage.local.get === "function"
      );
    }

    function get(key) {
      if (!hasStorage()) {
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          const runtimeError =
            typeof chrome !== "undefined" && chrome.runtime
              ? chrome.runtime.lastError
              : null;
          if (runtimeError) {
            resolve(null);
            return;
          }

          resolve(
            result && typeof result === "object" ? result[key] || null : null
          );
        });
      });
    }

    function set(key, value) {
      if (!hasStorage()) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (typeof chrome !== "undefined" && chrome.runtime) {
            void chrome.runtime.lastError;
          }
          resolve();
        });
      });
    }

    return {
      get,
      set,
    };
  }

  function createScoreCache({ storage, ttlMs, keyPrefix, buildDetailUrlImpl }) {
    async function read(asin) {
      const cacheKey = `${keyPrefix}${asin}`;
      const cachedValue = await storage.get(cacheKey);
      if (!cachedValue) {
        return null;
      }

      const fetchedAt = Date.parse(cachedValue.fetchedAt);
      const cacheAgeMs = Date.now() - fetchedAt;
      if (!Number.isFinite(cacheAgeMs) || cacheAgeMs < 0 || cacheAgeMs > ttlMs) {
        return null;
      }

      const normalizedCachedValue = normalizeSuccessPayload(cachedValue);
      if (!hasValidSuccessPayload(normalizedCachedValue)) {
        return null;
      }

      return {
        ...normalizedCachedValue,
        sourceUrl: buildDetailUrlImpl(asin),
      };
    }

    async function write(asin, payload) {
      const cacheKey = `${keyPrefix}${asin}`;
      await storage.set(cacheKey, normalizeSuccessPayload(payload));
    }

    return {
      read,
      write,
    };
  }

  function defaultWait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function createRequestCoordinator({
    minRequestIntervalMs,
    maxRequestJitterMs,
    waitImpl = defaultWait,
  }) {
    let nextAllowedRequestAt = 0;
    let executionChain = Promise.resolve();

    async function waitForTurn({
      waitOverride = waitImpl,
      nowImpl = Date.now,
      randomImpl = Math.random,
    } = {}) {
      const now = nowImpl();
      const waitMs = Math.max(0, nextAllowedRequestAt - now);
      if (waitMs > 0) {
        await waitOverride(waitMs);
      }

      const randomValue = Math.min(1, Math.max(0, Number(randomImpl()) || 0));
      const jitterMs = Math.floor(randomValue * maxRequestJitterMs);
      nextAllowedRequestAt = nowImpl() + minRequestIntervalMs + jitterMs;
    }

    function enqueue(task) {
      const queuedTask = executionChain.then(task, task);
      executionChain = queuedTask.catch(() => {});
      return queuedTask;
    }

    function reset() {
      nextAllowedRequestAt = 0;
      executionChain = Promise.resolve();
    }

    return {
      enqueue,
      reset,
      waitForTurn,
    };
  }

  const storageAdapter = createStorageAdapter();
  const scoreCache = createScoreCache({
    storage: storageAdapter,
    ttlMs: CACHE_TTL_MS,
    keyPrefix: CACHE_PREFIX,
    buildDetailUrlImpl: buildDetailUrl,
  });
  const requestCoordinator = createRequestCoordinator({
    minRequestIntervalMs: MIN_REQUEST_INTERVAL_MS,
    maxRequestJitterMs: MAX_REQUEST_JITTER_MS,
  });
  const inFlightRequests = new Map();

  function resetForTests() {
    inFlightRequests.clear();
    requestCoordinator.reset();
  }

  function buildSuccessPayload(asin, renderedResult) {
    return {
      ok: true,
      cached: false,
      fetchedAt: new Date().toISOString(),
      sourceUrl: buildDetailUrl(asin),
      score: renderedResult.score,
      verdict: renderedResult.verdict,
    };
  }

  function normalizeFetchFailure(asin, renderedResult) {
    return createFailure(
      renderedResult && renderedResult.code ? renderedResult.code : "parse_error",
      renderedResult && renderedResult.message
        ? renderedResult.message
        : "Could not extract a rendered Sakura Checker score.",
      buildDetailUrl(asin)
    );
  }

  // Only explicit failures should consult backup retry codes; anything else
  // either succeeded already or is ambiguous enough to warrant one backup try.
  function shouldRetryWithBackupSearch(renderedResult) {
    if (hasValidSuccessPayload(renderedResult)) {
      return false;
    }

    if (!renderedResult) {
      return true;
    }

    if (renderedResult.ok === false) {
      return BACKUP_ERROR_CODES.has(renderedResult.code);
    }

    return false;
  }

  async function attemptRenderedFetch(fetchRenderedScore, options, sourceUrl) {
    try {
      return normalizeSuccessPayload(await fetchRenderedScore(options));
    } catch (error) {
      return createFailure(
        "network_error",
        error instanceof Error ? error.message : "Failed to inspect Sakura Checker.",
        sourceUrl
      );
    }
  }

  async function fetchFreshScore({
    asin,
    productUrl,
    fetchRenderedScore,
    nowImpl,
    randomImpl,
    waitImpl,
  }) {
    const requestUrl = buildSourceUrl(asin);
    const sourceUrl = buildDetailUrl(asin);
    const normalizedProductUrl = normalizeSearchWord(productUrl);
    let renderedResult = null;

    await requestCoordinator.waitForTurn({
      waitOverride: waitImpl,
      nowImpl,
      randomImpl,
    });

    renderedResult = await attemptRenderedFetch(
      fetchRenderedScore,
      {
        asin,
        sourceUrl: requestUrl,
      },
      sourceUrl
    );

    if (
      Boolean(renderedResult && renderedResult.code === "url_search_required") ||
      shouldRetryWithBackupSearch(renderedResult)
    ) {
      renderedResult = await attemptRenderedFetch(
        fetchRenderedScore,
        {
          asin,
          sourceUrl,
          urlSearchProductUrl: normalizedProductUrl || buildAmazonProductUrl(asin),
        },
        sourceUrl
      );
    }

    if (isPercentScorePayload(renderedResult)) {
      const detailResult = await attemptRenderedFetch(
        fetchRenderedScore,
        {
          asin,
          sourceUrl,
        },
        sourceUrl
      );
      if (hasValidSuccessPayload(detailResult) && !isPercentScorePayload(detailResult)) {
        renderedResult = detailResult;
      }
    }

    if (shouldRetryWithBackupSearch(renderedResult)) {
      renderedResult = await attemptRenderedFetch(
        fetchRenderedScore,
        {
          asin,
          sourceUrl: requestUrl,
        },
        sourceUrl
      );
    }

    if (!renderedResult || !renderedResult.ok) {
      return normalizeFetchFailure(asin, renderedResult);
    }

    if (!hasValidSuccessPayload(renderedResult)) {
      return createFailure(
        "parse_error",
        "The rendered Sakura Checker response did not include a usable score.",
        sourceUrl
      );
    }

    const payload = buildSuccessPayload(asin, renderedResult);
    await scoreCache.write(asin, payload);
    return payload;
  }

  async function checkSakuraScore({
    asin,
    forceRefresh = false,
    productUrl,
    fetchRenderedScoreImpl,
    nowImpl,
    randomImpl,
    waitImpl,
  }) {
    const sourceUrl = buildDetailUrl(asin);

    if (!RenderedScoreClient && typeof fetchRenderedScoreImpl !== "function") {
      return createFailure(
        "parse_error",
        "The rendered score client is not available in the background context.",
        sourceUrl
      );
    }

    if (!forceRefresh) {
      const cachedValue = await scoreCache.read(asin);
      if (cachedValue) {
        return { ...cachedValue, cached: true };
      }
    }

    const fetchRenderedScore =
      typeof fetchRenderedScoreImpl === "function"
        ? fetchRenderedScoreImpl
        : RenderedScoreClient.fetchRenderedScore;
    const requestKey = String(asin || "");

    if (inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey);
    }

    const requestPromise = requestCoordinator
      .enqueue(() =>
        fetchFreshScore({
          asin,
          productUrl,
          fetchRenderedScore,
          nowImpl,
          randomImpl,
          waitImpl,
        })
      )
      .finally(() => {
        if (inFlightRequests.get(requestKey) === requestPromise) {
          inFlightRequests.delete(requestKey);
        }
      });

    inFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  return {
    buildDetailUrl,
    checkSakuraScore,
    __testing: {
      reset: resetForTests,
      writeCache: scoreCache.write,
    },
  };
});
