const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const renderedParser = require("../background/rendered-score-parser.js");

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const WAIT_TIMEOUT_MS = 30000;
const browserCompareEnabled = process.env.ENABLE_BROWSER_COMPARE === "1";

function getChromePath() {
  return CHROME_PATHS.find((candidate) => fs.existsSync(candidate)) || null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForJsonVersion(port) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Wait for Chrome to start listening.
    }

    await delay(200);
  }

  throw new Error("Timed out waiting for Chrome DevTools endpoint.");
}

async function waitForPageWebSocketUrl(port) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (pageTarget) {
          return pageTarget.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Wait for the initial page target to become available.
    }

    await delay(200);
  }

  throw new Error("Timed out waiting for a Chrome page target.");
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve());
      this.socket.addEventListener("error", (event) => reject(event.error || new Error("CDP socket error")));
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!Object.prototype.hasOwnProperty.call(message, "id")) {
        return;
      }

      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "CDP command failed."));
        return;
      }

      pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.opened;
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }

    await delay(100);
  }
}

async function launchChrome(chromePath) {
  const port = 9000 + Math.floor(Math.random() * 1000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sakura-checker-test-"));
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    }
  );

  try {
    await waitForJsonVersion(port);
    const pageWebSocketUrl = await waitForPageWebSocketUrl(port);
    return {
      chromeProcess,
      cdpClient: new CdpClient(pageWebSocketUrl),
      userDataDir,
    };
  } catch (error) {
    chromeProcess.kill("SIGKILL");
    fs.rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function closeChrome(session) {
  await session.cdpClient.close();
  if (!session.chromeProcess.killed) {
    session.chromeProcess.kill("SIGKILL");
  }

  await new Promise((resolve) => {
    if (session.chromeProcess.exitCode !== null) {
      resolve();
      return;
    }

    session.chromeProcess.once("exit", () => resolve());
    setTimeout(resolve, 2000);
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(session.userDataDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error && error.code !== "EPERM") {
        throw error;
      }
      await delay(200);
    }
  }

  fs.rmSync(session.userDataDir, { recursive: true, force: true });
}

async function evaluateValue(cdpClient, expression) {
  const result = await cdpClient.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }

  return result.result.value;
}

async function waitForRenderedPrimaryScore(cdpClient, extractSource, asin) {
  const expression = `(${extractSource})(document, ${JSON.stringify(asin)})`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    const result = await evaluateValue(cdpClient, expression);
    if (result && result.ok) {
      return result;
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for the rendered top score.");
}

async function compareRenderedScorePixels(cdpClient, parsedImages) {
  const expression = `(() => {
    const parsedSources = ${JSON.stringify(parsedImages.map((image) => image.src))};

    async function renderSourcesToDataUrl(sources) {
      const loadedImages = await Promise.all(
        sources.map((source) => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Failed to load score image."));
          image.src = source;
        }))
      );

      const width = loadedImages.reduce((total, image) => total + image.naturalWidth, 0);
      const height = loadedImages.reduce((maxHeight, image) => Math.max(maxHeight, image.naturalHeight), 0);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      let offsetX = 0;
      for (const image of loadedImages) {
        context.drawImage(image, offsetX, 0);
        offsetX += image.naturalWidth;
      }

      return canvas.toDataURL("image/png");
    }

    function collectLegacySources() {
      const candidates = Array.from(document.querySelectorAll(".item-review-wrap .item-info, .item-info"))
        .map((itemInfo) => {
          const imageGroups = Array.from(itemInfo.querySelectorAll("p.item-rating"))
            .map((ratingNode) =>
              Array.from(ratingNode.querySelectorAll("img")).map(
                (image) => image.getAttribute("src") || image.src
              )
            )
            .filter((group) => group.length);
          if (!imageGroups.length) {
            return null;
          }

          const richestGroup = imageGroups.reduce((best, current) =>
            current.length > best.length ? current : best
          );
          const sources =
            richestGroup.length > 1 ? richestGroup : imageGroups.flat();
          let score = sources.length * 10;

          if (itemInfo.querySelector(".item-review-level")) {
            score += 100;
          }
          if (itemInfo.querySelector(".item-rv-score")) {
            score += 50;
          }
          if (itemInfo.querySelector(".button-mini, .button.button-mini, .item-review-level a")) {
            score += 25;
          }

          return { score, sources };
        })
        .filter(Boolean);

      if (!candidates.length) {
        return [];
      }

      return candidates.reduce((best, current) =>
        current.score > best.score ? current : best
      ).sources;
    }

    return (async () => {
      const modernScoreRoot = document.querySelector(".sakura-alert .sakura-num");
      const modernPercentRoot = modernScoreRoot && modernScoreRoot.querySelector(".sakura-num-per");
      const modernSources = modernScoreRoot
        ? Array.from(modernScoreRoot.querySelectorAll("img"))
            .filter((image) => !modernPercentRoot || !modernPercentRoot.contains(image))
            .map((image) => image.getAttribute("src") || image.src)
        : [];
      if (modernSources.length) {
        return {
          displayedCount: modernSources.length,
          parsedCount: parsedSources.length,
          displayedComposite: await renderSourcesToDataUrl(modernSources),
          parsedComposite: await renderSourcesToDataUrl(parsedSources),
        };
      }

      const displayedSources = collectLegacySources();
      if (!displayedSources.length) {
        return null;
      }

      return {
        displayedCount: displayedSources.length,
        parsedCount: parsedSources.length,
        displayedComposite: await renderSourcesToDataUrl(displayedSources),
        parsedComposite: await renderSourcesToDataUrl(parsedSources),
      };
    })();
  })()`;

  return evaluateValue(cdpClient, expression);
}

async function captureScreenshotOnFailure(cdpClient, asin) {
  try {
    const result = await cdpClient.send("Page.captureScreenshot", { format: "png" });
    const screenshotPath = path.join(os.tmpdir(), `sakura-browser-compare-${asin}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
    return screenshotPath;
  } catch {
    return null;
  }
}

const chromePath = getChromePath();

test("browser-rendered top score visually matches the rendered DOM extractor output for B095JGJCC7", {
  skip: !browserCompareEnabled || !chromePath || typeof WebSocket !== "function",
  timeout: 45000,
}, async () => {
  const asin = "B095JGJCC7";
  const url = `https://sakura-checker.jp/search/${asin}/`;
  const extractSource = renderedParser.extractRenderedScore.toString();

  const session = await launchChrome(chromePath);

  try {
    await session.cdpClient.send("Page.enable");
    await session.cdpClient.send("Runtime.enable");
    await session.cdpClient.send("Page.navigate", { url });

    const parsed = await waitForRenderedPrimaryScore(session.cdpClient, extractSource, asin);

    assert.equal(parsed.ok, true);
    assert.ok(parsed.score.images.length >= 1);

    const comparison = await compareRenderedScorePixels(session.cdpClient, parsed.score.images);

    assert.ok(comparison, "Could not compare the rendered score images.");
    assert.equal(comparison.parsedCount, parsed.score.images.length);
    assert.equal(comparison.displayedCount, parsed.score.images.length);
    assert.equal(comparison.parsedComposite, comparison.displayedComposite);
  } catch (error) {
    const screenshotPath = await captureScreenshotOnFailure(session.cdpClient, asin);
    if (screenshotPath) {
      error.message = `${error.message} Screenshot: ${screenshotPath}`;
    }
    throw error;
  } finally {
    await closeChrome(session);
  }
});
