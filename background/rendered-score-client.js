(function (root, factory) {
  const exportsObject = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.RenderedScoreClient = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_POLL_INTERVAL_MS = 250;
  const PARSER_SCRIPT_FILE = "background/rendered-score-parser.js";

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

  function injectParser(tabId) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.scripting ||
        typeof chrome.scripting.executeScript !== "function"
      ) {
        reject(new Error("chrome.scripting.executeScript is not available."));
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: [PARSER_SCRIPT_FILE],
        },
        () => {
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.lastError
          ) {
            reject(createChromeError("Failed to prepare the Sakura Checker parser."));
            return;
          }

          resolve();
        }
      );
    });
  }

  async function injectParserWithRetry(tabId, options = {}) {
    const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    const pollIntervalMs = Number(options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        await injectParser(tabId);
        return;
      } catch (error) {
        lastError = error;
      }

      await delay(pollIntervalMs);
    }

    throw lastError || new Error("Timed out preparing the Sakura Checker parser.");
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

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: (requestedAsin) => {
            if (
              typeof self === "undefined" ||
              !self.RenderedScoreParser ||
              typeof self.RenderedScoreParser.extractRenderedScore !== "function"
            ) {
              return {
                ok: false,
                code: "parse_error",
                message: "RenderedScoreParser.extractRenderedScore is not available.",
                retryable: false,
              };
            }

            return self.RenderedScoreParser.extractRenderedScore(document, requestedAsin);
          },
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

  function executeTabFunction(tabId, func, args = [], defaultMessage = "Failed to run a script.") {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.scripting ||
        typeof chrome.scripting.executeScript !== "function"
      ) {
        reject(new Error("chrome.scripting.executeScript is not available."));
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func,
          args,
        },
        (injectionResults) => {
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.lastError
          ) {
            reject(createChromeError(defaultMessage));
            return;
          }

          const firstResult = Array.isArray(injectionResults) ? injectionResults[0] : null;
          resolve(firstResult ? firstResult.result : null);
        }
      );
    });
  }

  function waitForTabReload(tabId, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let cleanup = () => {};

    const promise = new Promise((resolve, reject) => {
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
      let sawLoading = false;
      let timeoutId = null;

      cleanup = () => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        chrome.tabs.onUpdated.removeListener(handleUpdated);
      }

      function handleUpdated(updatedTabId, changeInfo, tab) {
        if (updatedTabId !== tabId) {
          return;
        }

        if (changeInfo.status === "loading") {
          sawLoading = true;
          return;
        }

        if (sawLoading && (changeInfo.status === "complete" || (tab && tab.status === "complete"))) {
          cleanup();
          resolve(tab || { id: tabId, status: "complete" });
        }
      }

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for the Sakura Checker page to reload."));
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(handleUpdated);
    });

    return {
      promise,
      cancel() {
        cleanup();
      },
    };
  }

  async function submitProductUrlSearch(tabId, amazonProductUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const reloadHandle = waitForTabReload(tabId, timeoutMs);
    let submissionResult = null;

    try {
      submissionResult = await executeTabFunction(
        tabId,
        (productUrl) => {
          const input = document.querySelector("#urlsearchForm");
          if (!input) {
            return {
              ok: false,
              message: "The Sakura Checker search input is not available.",
            };
          }

          input.value = productUrl;
          input.setAttribute("value", productUrl);

          if (typeof self.setactionsearchForm === "function") {
            self.setactionsearchForm(true);
            return { ok: true, method: "setactionsearchForm" };
          }

          const form = document.querySelector("#searchForm");
          if (!form) {
            return {
              ok: false,
              message: "The Sakura Checker search form is not available.",
            };
          }

          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
            return { ok: true, method: "requestSubmit" };
          }

          if (typeof form.submit === "function") {
            form.submit();
            return { ok: true, method: "submit" };
          }

          return {
            ok: false,
            message: "The Sakura Checker search form could not be submitted.",
          };
        },
        [amazonProductUrl],
        "Failed to submit the Sakura Checker URL search."
      );
    } catch (error) {
      reloadHandle.cancel();
      throw error;
    }

    if (!submissionResult || submissionResult.ok !== true) {
      reloadHandle.cancel();
      throw new Error(
        submissionResult && submissionResult.message
          ? submissionResult.message
          : "Could not submit the Sakura Checker URL search."
      );
    }

    await reloadHandle.promise;
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

  async function fetchRenderedScore({
    asin,
    sourceUrl,
    timeoutMs,
    pollIntervalMs,
    urlSearchProductUrl,
  }) {
    let tab = null;

    try {
      tab = await tabsCreate({
        url: sourceUrl,
        active: false,
      });

      await waitForTabComplete(tab.id, timeoutMs);
      if (typeof urlSearchProductUrl === "string" && urlSearchProductUrl.trim()) {
        await submitProductUrlSearch(tab.id, urlSearchProductUrl, timeoutMs);
      }
      await injectParserWithRetry(tab.id, {
        timeoutMs,
        pollIntervalMs,
      });
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
    fetchRenderedScore,
  };
});
