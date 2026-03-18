const test = require("node:test");
const assert = require("node:assert/strict");

const renderedScoreClient = require("../background/rendered-score-client.js");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function installChromeStub({ completeDelayMs = 0, scriptResponder }) {
  const listeners = new Set();
  const tabs = new Map();
  const createCalls = [];
  const removeCalls = [];
  let nextTabId = 1;
  let executeCalls = 0;
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
        callback([
          {
            result: scriptResponder(details, executeCalls),
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
    assert.ok(stub.executeCalls >= 2);
    assert.deepEqual(stub.executeDetails[0].args, ["B095JGJCC7"]);
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
    assert.equal(stub.executeCalls, 1);
  } finally {
    stub.cleanup();
  }
});
