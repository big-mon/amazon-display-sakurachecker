const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const renderedParser = require("../background/rendered-score-parser.js");

const knownAsins = ["B0921THFXZ", "B095JGJCC7"];
const retryDelaysMs = [1000, 3000];
const liveSmokeTestTimeoutMs = 60000;
const renderTimeoutMs = 30000;

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
        suffix: result.score ? result.score.suffix : null,
        imageCount: result.score ? result.score.images.length : null,
      })}`
    );
  }

  if (error) {
    parts.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return parts.join(" ");
}

async function extractRenderedScore(page, asin) {
  return page.evaluate(({ extractSource, asin: requestedAsin }) => {
    const extract = Function(`return (${extractSource});`)();
    return extract(document, requestedAsin);
  }, {
    extractSource: renderedParser.extractRenderedScore.toString(),
    asin,
  });
}

async function waitForRenderedScore(page, asin) {
  const startedAt = Date.now();
  let lastResult = null;

  while (Date.now() - startedAt < renderTimeoutMs) {
    const result = await extractRenderedScore(page, asin);
    if (result && result.ok) {
      return result;
    }

    lastResult = result;
    if (result && result.retryable) {
      await delay(250);
      continue;
    }

    return result;
  }

  return lastResult || {
    ok: false,
    code: "parse_error",
    message: "Timed out waiting for Sakura Checker to render the score.",
  };
}

async function runLiveSmokeWithRetry(asin) {
  let lastResult = null;
  let lastError = null;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    let browser = null;

    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        locale: "ja-JP",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      });

      await page.goto(`https://sakura-checker.jp/search/${asin}/`, {
        waitUntil: "domcontentloaded",
        timeout: renderTimeoutMs,
      });

      const result = await waitForRenderedScore(page, asin);
      lastResult = result;

      assert.equal(result.ok, true, formatFailure(asin, result));
      assert.equal(result.score.kind, "visual-image", formatFailure(asin, result));
      assert.equal(result.score.suffix, "/5", formatFailure(asin, result));
      assert.ok(result.score.images.length >= 1, formatFailure(asin, result));

      for (const image of result.score.images) {
        assert.match(image.src, /^data:image\//, formatFailure(asin, result));
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt === retryDelaysMs.length) {
        throw new Error(formatFailure(asin, lastResult, lastError), { cause: error });
      }

      await delay(retryDelaysMs[attempt]);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

for (const asin of knownAsins) {
  test(`live smoke returns rendered /5 score images for ${asin}`, { timeout: liveSmokeTestTimeoutMs }, async () => {
    await runLiveSmokeWithRetry(asin);
  });
}
