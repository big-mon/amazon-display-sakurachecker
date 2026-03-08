const test = require("node:test");
const assert = require("node:assert/strict");

const apiClient = require("../background/api-client.js");

const knownAsins = ["B0921THFXZ", "B095JGJCC7"];
const retryDelaysMs = [1000, 3000];

function liveFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options && options.headers ? options.headers : {}),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatFailure(asin, result, error) {
  const parts = [`ASIN ${asin} live smoke failed.`];

  if (result) {
    parts.push(
      `Result: ${JSON.stringify({
        ok: result.ok,
        code: result.code,
        message: result.message,
        sourceUrl: result.sourceUrl,
      })}`
    );
  }

  if (error) {
    parts.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return parts.join(" ");
}

async function runLiveSmokeWithRetry(asin) {
  let lastResult = null;
  let lastError = null;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const result = await apiClient.checkSakuraScore({
        asin,
        forceRefresh: true,
        fetchImpl: liveFetch,
      });

      lastResult = result;

      assert.equal(result.ok, true, formatFailure(asin, result));
      assert.equal(result.score.kind, "visual-image", formatFailure(asin, result));
      assert.ok(result.score.images.length >= 1, formatFailure(asin, result));

      for (const image of result.score.images) {
        assert.match(image.src, /^data:image\/png;base64,/, formatFailure(asin, result));
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt === retryDelaysMs.length) {
        throw new Error(formatFailure(asin, lastResult, lastError), { cause: error });
      }

      await delay(retryDelaysMs[attempt]);
    }
  }

  throw new Error(formatFailure(asin, lastResult, lastError));
}

for (const asin of knownAsins) {
  test(`live smoke returns score images for ${asin}`, { timeout: 45000 }, async () => {
    await runLiveSmokeWithRetry(asin);
  });
}
