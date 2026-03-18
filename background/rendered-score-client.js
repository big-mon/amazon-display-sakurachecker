(function (root, factory) {
  const exportsObject = factory(
    root.RenderedScoreParser,
    typeof module !== "undefined" && module.exports
      ? require("./rendered-score-parser.js")
      : null
  );
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.RenderedScoreClient = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function (workerParser, nodeParser) {
  const RenderedScoreParser = workerParser || nodeParser;
  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_POLL_INTERVAL_MS = 250;

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function createChromeError(defaultMessage) {
    const runtimeError =
      typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.lastError : null;
    if (runtimeError && runtimeError.message) {
      return new Error(runtimeError.message);
    }

    return new Error(defaultMessage);
  }

  function tabsCreate(createProperties) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs ||
        typeof chrome.tabs.create !== "function"
      ) {
        reject(new Error("chrome.tabs.create is not available."));
        return;
      }

      chrome.tabs.create(createProperties, (tab) => {
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          chrome.runtime.lastError
        ) {
          reject(createChromeError("Failed to create a Sakura Checker tab."));
          return;
        }

        if (!tab || typeof tab.id !== "number") {
          reject(new Error("The Sakura Checker tab did not return a valid tab ID."));
          return;
        }

        resolve(tab);
      });
    });
  }

  function tabsGet(tabId) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs ||
        typeof chrome.tabs.get !== "function"
      ) {
        reject(new Error("chrome.tabs.get is not available."));
        return;
      }

      chrome.tabs.get(tabId, (tab) => {
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          chrome.runtime.lastError
        ) {
          reject(createChromeError("Failed to read the Sakura Checker tab state."));
          return;
        }

        resolve(tab);
      });
    });
  }

  function tabsRemove(tabId) {
    return new Promise((resolve) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs ||
        typeof chrome.tabs.remove !== "function"
      ) {
        resolve();
        return;
      }

      chrome.tabs.remove(tabId, () => {
        resolve();
      });
    });
  }

  function executeExtract(tabId, asin) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.scripting ||
        typeof chrome.scripting.executeScript !== "function"
      ) {
        reject(new Error("chrome.scripting.executeScript is not available."));
        return;
      }

      if (
        !RenderedScoreParser ||
        typeof RenderedScoreParser.extractRenderedScore !== "function"
      ) {
        reject(new Error("RenderedScoreParser.extractRenderedScore is not available."));
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: RenderedScoreParser.extractRenderedScore,
          args: asin ? [asin] : [],
        },
        (injectionResults) => {
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.lastError
          ) {
            reject(createChromeError("Failed to inspect the rendered Sakura Checker page."));
            return;
          }

          const firstResult = Array.isArray(injectionResults) ? injectionResults[0] : null;
          resolve(firstResult ? firstResult.result : null);
        }
      );
    });
  }

  function waitForTabComplete(tabId, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs ||
        !chrome.tabs.onUpdated ||
        typeof chrome.tabs.onUpdated.addListener !== "function"
      ) {
        reject(new Error("chrome.tabs.onUpdated is not available."));
        return;
      }

      let settled = false;
      let timeoutId = null;

      function cleanup() {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        chrome.tabs.onUpdated.removeListener(handleUpdated);
      }

      function resolveIfComplete(tab) {
        if (tab && tab.status === "complete") {
          cleanup();
          resolve(tab);
          return true;
        }

        return false;
      }

      function handleUpdated(updatedTabId, changeInfo, tab) {
        if (updatedTabId !== tabId) {
          return;
        }

        if (changeInfo.status === "complete" || (tab && tab.status === "complete")) {
          cleanup();
          resolve(tab || { id: tabId, status: "complete" });
        }
      }

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for the Sakura Checker tab to finish loading."));
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(handleUpdated);
      tabsGet(tabId)
        .then((tab) => {
          resolveIfComplete(tab);
        })
        .catch(() => {
          // Ignore read failures here and let the timeout or update listener decide.
        });
    });
  }

  async function pollExtractedScore(tabId, options = {}) {
    const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    const pollIntervalMs = Number(options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
    const asin = options.asin || null;
    const startedAt = Date.now();
    let lastResult = null;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const result = await executeExtract(tabId, asin);
        if (result && result.ok) {
          return result;
        }

        lastResult = result;
        if (result && result.retryable) {
          await delay(pollIntervalMs);
          continue;
        }

        if (result && result.code) {
          return result;
        }
      } catch (error) {
        lastResult = {
          ok: false,
          code: "network_error",
          message: error instanceof Error ? error.message : "Failed to inspect Sakura Checker.",
          retryable: true,
        };
      }

      await delay(pollIntervalMs);
    }

    return {
      ok: false,
      code: "parse_error",
      message:
        lastResult && lastResult.code === "not_ready"
          ? "Timed out waiting for Sakura Checker to render the score."
          : (lastResult && lastResult.message) ||
            "Could not extract a rendered Sakura Checker score.",
      retryable: false,
    };
  }

  async function fetchRenderedScore({ asin, sourceUrl, timeoutMs, pollIntervalMs }) {
    let tab = null;

    try {
      tab = await tabsCreate({
        url: sourceUrl,
        active: false,
      });

      await waitForTabComplete(tab.id, timeoutMs);
      return await pollExtractedScore(tab.id, {
        asin,
        timeoutMs,
        pollIntervalMs,
      });
    } finally {
      if (tab && typeof tab.id === "number") {
        await tabsRemove(tab.id);
      }
    }
  }

  return {
    DEFAULT_POLL_INTERVAL_MS,
    DEFAULT_TIMEOUT_MS,
    executeExtract,
    fetchRenderedScore,
    pollExtractedScore,
    tabsCreate,
    tabsGet,
    tabsRemove,
    waitForTabComplete,
  };
});
