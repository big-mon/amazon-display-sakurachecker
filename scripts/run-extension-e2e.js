#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

function extractAsinFromUrl(urlValue) {
  if (!urlValue) {
    return null;
  }

  try {
    const parsed = new URL(urlValue);
    const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

function resolveAsin() {
  const explicitAsin = process.env.SAKURA_E2E_ASIN;
  const overriddenUrl = process.env.SAKURA_E2E_URL;

  if (overriddenUrl) {
    const extractedAsin = extractAsinFromUrl(overriddenUrl);
    if (extractedAsin) {
      return extractedAsin;
    }
    if (explicitAsin) {
      return explicitAsin;
    }

    throw new Error(
      "Could not extract an ASIN from SAKURA_E2E_URL. Set SAKURA_E2E_ASIN explicitly."
    );
  }

  return explicitAsin || "B095JGJCC7";
}

const DEFAULT_ASIN = resolveAsin();
const DEFAULT_URL = process.env.SAKURA_E2E_URL || `https://www.amazon.co.jp/dp/${DEFAULT_ASIN}`;
const OUTPUT_DIR = path.join(process.cwd(), "output", "playwright");
const FAILURE_SCREENSHOT_PATH = path.join(OUTPUT_DIR, "extension-e2e-failure.png");
const SUCCESS_SCREENSHOT_PATH = path.join(OUTPUT_DIR, `extension-e2e-${DEFAULT_ASIN}.png`);
const SETTLE_TIMEOUT_MS = Number(process.env.SAKURA_E2E_TIMEOUT_MS || 45000);
const EXPECTED_SUFFIX = process.env.SAKURA_E2E_EXPECT_SUFFIX || "/5";
const HEADLESS = process.env.PW_EXTENSION_HEADLESS !== "0";

function encodeItemSearchWord(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function isSupportedSuffix(value) {
  return value === "/5" || value === "%";
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function waitForExtensionServiceWorker(context) {
  const existing = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith("chrome-extension://"));
  if (existing) {
    return existing;
  }

  return context.waitForEvent(
    "serviceworker",
    {
      predicate: (worker) => worker.url().startsWith("chrome-extension://"),
      timeout: 15000,
    }
  );
}

function getExtensionId(serviceWorker) {
  return new URL(serviceWorker.url()).hostname;
}

async function collectPanelState(page) {
  return page.evaluate(() => {
    const root = document.getElementById("sakura-checker-result");
    if (!root) {
      return null;
    }

    const link = root.querySelector("a");
    const scoreImages = Array.from(root.querySelectorAll(".sc-score-images img")).map((image) => ({
      src: image.getAttribute("src") || image.src,
      alt: image.getAttribute("alt") || "",
    }));
    const verdictImageNode = root.querySelector(".sc-verdict img");
    const verdictTextNode = root.querySelector(".sc-verdict-text");
    const scoreTextNode = root.querySelector(".sc-score-text");
    const suffixNode = root.querySelector(".sc-suffix");

    return {
      state: root.dataset.state || null,
      text: root.innerText || "",
      linkHref: link ? link.href : null,
      scoreImageCount: scoreImages.length,
      scoreImages,
      scoreText: scoreTextNode ? scoreTextNode.textContent || "" : "",
      scoreSuffix: suffixNode ? suffixNode.textContent || "" : "",
      verdictImage: verdictImageNode
        ? {
            src: verdictImageNode.getAttribute("src") || verdictImageNode.src,
            alt: verdictImageNode.getAttribute("alt") || "",
          }
        : null,
      verdictText: verdictTextNode ? verdictTextNode.textContent || "" : "",
      url: location.href,
      title: document.title,
    };
  });
}

async function run() {
  ensureOutputDir();

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sakura-extension-e2e-"));
  let context = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: HEADLESS,
      args: [
        `--disable-extensions-except=${process.cwd()}`,
        `--load-extension=${process.cwd()}`,
      ],
    });

    const serviceWorker = await waitForExtensionServiceWorker(context);
    const extensionId = getExtensionId(serviceWorker);

    const page = context.pages()[0] || (await context.newPage());
    await page.goto(DEFAULT_URL, { waitUntil: "domcontentloaded", timeout: SETTLE_TIMEOUT_MS });
    await page.waitForSelector("#sakura-checker-result", { timeout: SETTLE_TIMEOUT_MS });
    await page.waitForFunction(
      () => {
        const root = document.getElementById("sakura-checker-result");
        return root && ["success", "error"].includes(root.dataset.state || "");
      },
      undefined,
      { timeout: SETTLE_TIMEOUT_MS }
    );

    const panel = await collectPanelState(page);
    if (!panel) {
      throw new Error("The Sakura Checker panel was not rendered.");
    }

    const expectedLink = `https://sakura-checker.jp/search/${DEFAULT_ASIN}/`;
    if (!panel.linkHref || !panel.linkHref.includes(expectedLink)) {
      throw new Error(`Unexpected panel link: ${panel.linkHref || "<missing>"}`);
    }
    if (panel.scoreImageCount < 1 && !panel.scoreText) {
      throw new Error("The Sakura Checker panel did not render a score.");
    }
    if (process.env.SAKURA_E2E_EXPECT_SUFFIX) {
      if (panel.scoreSuffix !== EXPECTED_SUFFIX) {
        throw new Error(`Unexpected score suffix: ${panel.scoreSuffix || "<missing>"}`);
      }
    } else if (!isSupportedSuffix(panel.scoreSuffix)) {
      throw new Error(`Unexpected score suffix: ${panel.scoreSuffix || "<missing>"}`);
    }

    await page.screenshot({ path: SUCCESS_SCREENSHOT_PATH, fullPage: true });
    console.log(
      JSON.stringify(
        {
          ok: true,
          extensionId,
          asin: DEFAULT_ASIN,
          screenshotPath: SUCCESS_SCREENSHOT_PATH,
          panel,
        },
        null,
        2
      )
    );
  } catch (error) {
    if (context) {
      const page = context.pages()[0];
      if (page) {
        try {
          await page.screenshot({ path: FAILURE_SCREENSHOT_PATH, fullPage: true });
        } catch {
          // Ignore screenshot failures and preserve the original error.
        }
      }
    }

    const screenshotSuffix = fs.existsSync(FAILURE_SCREENSHOT_PATH)
      ? ` Screenshot: ${FAILURE_SCREENSHOT_PATH}`
      : "";
    throw new Error(`${error.message}${screenshotSuffix}`, { cause: error });
  } finally {
    if (context) {
      await context.close();
    }

    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
