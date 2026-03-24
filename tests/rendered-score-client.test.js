const test = require("node:test");
const assert = require("node:assert/strict");

const renderedScoreClient = require("../background/rendered-score-client.js");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function installChromeStub({ completeDelayMs = 0, parserInjectionResponder, scriptResponder }) {
  const listeners = new Set();
  const tabs = new Map();
  const createCalls = [];
  const removeCalls = [];
  let nextTabId = 1;
  let executeCalls = 0;
  let parserInjectionCalls = 0;
  let extractCalls = 0;
  const executeDetails = [];

  global.chrome = {
    runtime: {
      lastError: null,
    },
    tabs: {
      create(createProperties, callback) {
        createCalls.push(createProperties);
        const tab = {
          id: nextTabId,
          status: "loading",
          url: createProperties.url,
        };
        nextTabId += 1;
        tabs.set(tab.id, tab);

        setTimeout(() => {
          tab.status = "complete";
          for (const listener of listeners) {
            listener(tab.id, { status: "complete" }, tab);
          }
        }, completeDelayMs);

        callback(tab);
      },
      get(tabId, callback) {
        callback(tabs.get(tabId) || null);
      },
      remove(tabId, callback) {
        removeCalls.push(tabId);
        tabs.delete(tabId);
        callback();
      },
      onUpdated: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
      },
    },
    scripting: {
      executeScript(details, callback) {
        executeCalls += 1;
        executeDetails.push(details);
        if (Array.isArray(details.files)) {
          parserInjectionCalls += 1;
          const injectionErrorMessage =
            typeof parserInjectionResponder === "function"
              ? parserInjectionResponder(details, parserInjectionCalls)
              : null;
          global.chrome.runtime.lastError = injectionErrorMessage
            ? { message: injectionErrorMessage }
            : null;
          callback([{ result: null }]);
          global.chrome.runtime.lastError = null;
          return;
        }
        extractCalls += 1;
        if (
          Array.isArray(details.args) &&
          details.args.length === 1 &&
          typeof details.args[0] === "string" &&
          /amazon\.co\.jp\/dp\//.test(details.args[0])
        ) {
          const tab = tabs.get(details.target.tabId);
          if (tab) {
            tab.status = "loading";
            for (const listener of listeners) {
              listener(tab.id, { status: "loading" }, tab);
            }

            setTimeout(() => {
              tab.status = "complete";
              for (const listener of listeners) {
                listener(tab.id, { status: "complete" }, tab);
              }
            }, completeDelayMs);
          }
        }
        callback([
          {
            result: scriptResponder(details, extractCalls),
          },
        ]);
      },
    },
  };

  return {
    createCalls,
    removeCalls,
    get executeCalls() {
      return executeCalls;
    },
    get extractCalls() {
      return extractCalls;
    },
    get parserInjectionCalls() {
      return parserInjectionCalls;
    },
    executeDetails,
    cleanup() {
      delete global.chrome;
    },
  };
}

test("fetchRenderedScore creates a temporary tab, polls, and closes it on success", async () => {
  const stub = installChromeStub({
    scriptResponder(_details, callCount) {
      if (callCount === 1) {
        return {
          ok: false,
          code: "not_ready",
          message: "Loading",
          retryable: true,
        };
      }

      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "4" }],
          suffix: "/5",
        },
        verdict: null,
      };
    },
  });

  try {
    const result = await renderedScoreClient.fetchRenderedScore({
      asin: "B095JGJCC7",
      sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
      timeoutMs: 200,
      pollIntervalMs: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(result.score.suffix, "/5");
    assert.equal(stub.createCalls.length, 1);
    assert.equal(stub.createCalls[0].active, false);
    assert.equal(stub.removeCalls.length, 1);
    assert.ok(stub.extractCalls >= 2);
    assert.deepEqual(stub.executeDetails[0].files, ["background/rendered-score-parser.js"]);
    assert.deepEqual(stub.executeDetails[1].args, ["B095JGJCC7"]);
  } finally {
    stub.cleanup();
  }
});

test("fetchRenderedScore retries transient parser injection failures before polling", async () => {
  const stub = installChromeStub({
    parserInjectionResponder(_details, callCount) {
      if (callCount === 1) {
        return "The tab is still navigating.";
      }

      return null;
    },
    scriptResponder() {
      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "4" }],
          suffix: "/5",
        },
        verdict: null,
      };
    },
  });

  try {
    const result = await renderedScoreClient.fetchRenderedScore({
      asin: "B095JGJCC7",
      sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
      timeoutMs: 200,
      pollIntervalMs: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(stub.parserInjectionCalls, 2);
    assert.equal(stub.extractCalls, 1);
  } finally {
    stub.cleanup();
  }
});

test("fetchRenderedScore closes the temporary tab after a render timeout", async () => {
  const stub = installChromeStub({
    scriptResponder() {
      return {
        ok: false,
        code: "not_ready",
        message: "Still loading",
        retryable: true,
      };
    },
  });

  try {
    const result = await renderedScoreClient.fetchRenderedScore({
      asin: "B095JGJCC7",
      sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
      timeoutMs: 25,
      pollIntervalMs: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "parse_error");
    assert.equal(stub.removeCalls.length, 1);
    assert.ok(stub.extractCalls > 1);
  } finally {
    stub.cleanup();
  }
});

test("fetchRenderedScore returns terminal extraction errors without retrying forever", async () => {
  const stub = installChromeStub({
    scriptResponder() {
      return {
        ok: false,
        code: "parse_error",
        message: "Broken markup",
        retryable: false,
      };
    },
  });

  try {
    const result = await renderedScoreClient.fetchRenderedScore({
      asin: "B095JGJCC7",
      sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
      timeoutMs: 200,
      pollIntervalMs: 1,
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "parse_error");
    assert.equal(result.message, "Broken markup");
    assert.equal(stub.removeCalls.length, 1);
    assert.equal(stub.extractCalls, 1);
  } finally {
    stub.cleanup();
  }
});

test("fetchRenderedScore can trigger a Sakura Checker product URL search before extracting", async () => {
  const stub = installChromeStub({
    scriptResponder(details) {
      if (
        Array.isArray(details.args) &&
        details.args.length === 1 &&
        typeof details.args[0] === "string" &&
        /amazon\.co\.jp\/dp\/B0BJDY6D1W/.test(details.args[0])
      ) {
        return {
          ok: true,
          method: "setactionsearchForm",
        };
      }

      return {
        ok: true,
        score: {
          kind: "visual-image",
          images: [{ src: "data:image/png;base64,AAAA", alt: "4" }],
          suffix: "/5",
        },
        verdict: null,
      };
    },
  });

  try {
    const result = await renderedScoreClient.fetchRenderedScore({
      asin: "B0BJDY6D1W",
      sourceUrl: "https://sakura-checker.jp/search/B0BJDY6D1W/",
      urlSearchProductUrl: "https://www.amazon.co.jp/dp/B0BJDY6D1W",
      timeoutMs: 200,
      pollIntervalMs: 1,
    });

    assert.equal(result.ok, true);
    assert.equal(stub.createCalls.length, 1);
    assert.ok(stub.extractCalls >= 2);
    assert.ok(
      stub.executeDetails.some(
        (details) =>
          Array.isArray(details.args) &&
          details.args[0] === "https://www.amazon.co.jp/dp/B0BJDY6D1W"
      )
    );
    assert.ok(
      stub.executeDetails.some(
        (details) =>
          Array.isArray(details.files) &&
          details.files[0] === "background/rendered-score-parser.js"
      )
    );
    assert.ok(
      stub.executeDetails.some(
        (details) => Array.isArray(details.args) && details.args[0] === "B0BJDY6D1W"
      )
    );
  } finally {
    stub.cleanup();
  }
});
