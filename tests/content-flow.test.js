const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.textContent = "";
    this.className = "";
    this.id = "";
    this.listeners = new Map();
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  insertAdjacentElement(position, element) {
    if (position === "afterbegin") {
      element.parentNode = this;
      this.children.unshift(element);
      return element;
    }

    if (position === "afterend" && this.parentNode) {
      const siblings = this.parentNode.children;
      const index = siblings.indexOf(this);
      element.parentNode = this.parentNode;
      siblings.splice(index + 1, 0, element);
      return element;
    }

    throw new Error(`Unsupported insertAdjacentElement position: ${position}`);
  }

  setAttribute(name, value) {
    const normalizedValue = String(value);
    this.attributes.set(name, normalizedValue);

    if (name === "id") {
      this.id = normalizedValue;
    }
    if (name === "class") {
      this.className = normalizedValue;
    }
    if (name.startsWith("data-")) {
      this.dataset[name.slice(5)] = normalizedValue;
    }
  }

  getAttribute(name) {
    if (name === "id") {
      return this.id || null;
    }
    if (name === "class") {
      return this.className || null;
    }
    if (name.startsWith("data-")) {
      return this.attributes.get(name) || null;
    }

    return this.attributes.get(name) || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const eventObject =
      typeof event === "string"
        ? { type: event }
        : event && typeof event === "object"
          ? event
          : { type: "" };
    const listeners = this.listeners.get(eventObject.type) || [];
    for (const listener of listeners) {
      listener.call(this, eventObject);
    }
    return true;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  querySelector(selector) {
    return findFirst(this, (element) => matchesSelector(element, selector));
  }

  querySelectorAll(selector) {
    const matches = [];
    walkTree(this, (element) => {
      if (matchesSelector(element, selector)) {
        matches.push(element);
      }
    });
    return matches;
  }
}

class FakeDocument {
  constructor({ url, readyState = "complete" }) {
    this.readyState = readyState;
    this.location = new URL(url);
    this.documentElement = new FakeElement("html", this);
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.listeners = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return findFirst(this.documentElement, (element) => matchesSelector(element, selector));
  }

  contains(node) {
    let found = false;
    walkTree(this.documentElement, (element) => {
      if (element === node) {
        found = true;
      }
    });
    return found;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(type) {
    const listeners = this.listeners.get(type) || [];
    for (const listener of listeners) {
      listener();
    }
  }
}

function walkTree(node, visit) {
  for (const child of node.children) {
    visit(child);
    walkTree(child, visit);
  }
}

function findFirst(root, predicate) {
  let match = null;

  walkTree(root, (element) => {
    if (!match && predicate(element)) {
      match = element;
    }
  });

  return match;
}

function matchesSelector(element, selector) {
  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  if (selector === "img") {
    return element.tagName === "IMG";
  }

  if (selector === 'link[rel="canonical"]') {
    return element.tagName === "LINK" && element.getAttribute("rel") === "canonical";
  }

  if (selector === "[data-asin]") {
    return element.attributes.has("data-asin");
  }

  return false;
}

function createPageDocument(url) {
  const document = new FakeDocument({ url });
  const titleFeature = document.createElement("div");
  titleFeature.id = "title_feature_div";
  document.body.appendChild(titleFeature);

  const centerCol = document.createElement("div");
  centerCol.id = "centerCol";
  document.body.appendChild(centerCol);

  return document;
}

function createExecutionContext({ document, chrome } = {}) {
  const mutationObservers = [];
  const context = {
    console,
    document: document || createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7"),
    chrome: chrome || { runtime: { sendMessage: async () => ({ ok: true }) } },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        mutationObservers.push(this);
      }

      observe() {}

      disconnect() {}
    },
    URL,
  };

  context.window = context;
  context.self = context;
  context.location = context.document.location;
  context.globalThis = context;
  context.__mutationObservers = mutationObservers;

  return vm.createContext(context);
}

function loadScript(context, relativePath) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function findImages(root) {
  const images = [];
  walkTree(root, (element) => {
    if (element.tagName === "IMG") {
      images.push(element);
    }
  });
  return images;
}

function findFirstByTag(root, tagName) {
  return findFirst(root, (element) => element.tagName === String(tagName).toUpperCase());
}

function findByClass(root, className) {
  return findFirst(root, (element) =>
    String(element.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .includes(className)
  );
}

function findAllByClass(root, className) {
  const matches = [];
  walkTree(root, (element) => {
    if (
      String(element.className || "")
        .split(/\s+/)
        .filter(Boolean)
        .includes(className)
    ) {
      matches.push(element);
    }
  });
  return matches;
}

function getNodeText(node) {
  let value = String(node.textContent || "");
  for (const child of node.children || []) {
    value += getNodeText(child);
  }
  return value;
}

function getChildNodeTexts(node) {
  return (node.children || []).map((child) => getNodeText(child));
}

test("content.js initializes SakuraChecker immediately after document_end", () => {
  const document = new FakeDocument({
    url: "https://www.amazon.co.jp/dp/B095JGJCC7",
    readyState: "complete",
  });
  const context = createExecutionContext({ document });
  let initialized = 0;
  context.window.SakuraChecker = {
    init() {
      initialized += 1;
    },
  };

  loadScript(context, "content.js");

  assert.equal(initialized, 1);
});

test("UiDisplay renders the panel after the Amazon title area", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderLoading(
    "https://sakura-checker.jp/itemsearch/?word=QjA5NUpHSkNDNw=="
  );

  const root = document.getElementById("sakura-checker-result");
  assert.ok(root);
  assert.equal(root.dataset.state, "loading");
  assert.equal(document.body.children[1], root);

  const link = findFirst(root, (element) => element.tagName === "A");
  assert.ok(link);
  assert.equal(link.href, "https://sakura-checker.jp/itemsearch/?word=QjA5NUpHSkNDNw==");
});

test("AsinExtractor ignores search result data-asin entries on non-product pages", () => {
  const document = createPageDocument("https://www.amazon.co.jp/s?k=keyboard");
  const searchResult = document.createElement("div");
  searchResult.setAttribute("data-asin", "B095JGJCC7");
  document.body.appendChild(searchResult);

  const context = createExecutionContext({ document });
  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");

  assert.equal(context.window.AsinExtractor.extractProductASIN(), null);
  assert.equal(context.window.AsinExtractor.isProductPage(), false);
});

test("AsinExtractor reads the canonical product URL when pathname is not a product path", () => {
  const document = createPageDocument("https://www.amazon.co.jp/gp/aw");
  const canonical = document.createElement("link");
  canonical.setAttribute("rel", "canonical");
  canonical.setAttribute("href", "https://www.amazon.co.jp/gp/aw/d/B095JGJCC7");
  document.head.appendChild(canonical);

  const context = createExecutionContext({ document });
  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");

  assert.equal(context.window.AsinExtractor.extractProductASIN(), "B095JGJCC7");
  assert.equal(context.window.AsinExtractor.isProductPage(), true);
});

test("SakuraChecker refresh shows loading first and then renders fetched score images", async () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  let resolveResponse = null;
  const chrome = {
    runtime: {
      sendMessage: async (payload) =>
        new Promise((resolve) => {
          resolveResponse = { payload, resolve };
        }),
    },
  };
  const context = createExecutionContext({ document, chrome });

  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");
  loadScript(context, "content/ui-display.js");
  loadScript(context, "content/sakura-checker.js");

  const refreshPromise = context.window.SakuraChecker.refreshForCurrentPage();

  const loadingRoot = document.getElementById("sakura-checker-result");
  assert.ok(loadingRoot);
  assert.equal(loadingRoot.dataset.state, "loading");
  assert.ok(resolveResponse);
  assert.equal(resolveResponse.payload.asin, "B095JGJCC7");

  resolveResponse.resolve({
    ok: true,
    cached: false,
    sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjA5NUpHSkNDNw==",
    score: {
      kind: "visual-image",
      suffix: "/5",
      images: [
        { src: "data:image/png;base64,AAA", alt: "1" },
        { src: "data:image/png;base64,BBB", alt: "2" },
      ],
    },
    verdict: {
      kind: "visual-verdict",
      image: { src: "https://sakura-checker.jp/images/rv_level03.png", alt: "判定" },
      lines: ["Amazonより", "危険なスコア"],
    },
  });

  await refreshPromise;

  const successRoot = document.getElementById("sakura-checker-result");
  assert.ok(successRoot);
  assert.equal(successRoot.dataset.state, "success");

  const images = findImages(successRoot);
  assert.equal(images.length, 3);
  assert.equal(images[0].src, "data:image/png;base64,AAA");
  assert.equal(images[1].src, "data:image/png;base64,BBB");
  assert.equal(images[2].src, "https://sakura-checker.jp/images/rv_level03.png");
});

test("SakuraChecker renders a refresh button for cached results and refetches on click", async () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const sendMessageCalls = [];
  const chrome = {
    runtime: {
      sendMessage: async (payload) => {
        sendMessageCalls.push(payload);

        return {
          ok: true,
          cached: payload.forceRefresh !== true,
          sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
          score: {
            kind: "text",
            value: payload.forceRefresh === true ? "4.70" : "4.29",
            suffix: "/5",
          },
          verdict: {
            kind: "text-verdict",
            lines: ["安全", "サクラ度 0%"],
          },
        };
      },
    },
  };
  const context = createExecutionContext({ document, chrome });

  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");
  loadScript(context, "content/ui-display.js");
  loadScript(context, "content/sakura-checker.js");

  await context.window.SakuraChecker.refreshForCurrentPage();

  let root = document.getElementById("sakura-checker-result");
  let refreshButton = findFirstByTag(root, "button");
  assert.ok(refreshButton);
  assert.equal(sendMessageCalls.length, 1);
  assert.equal(sendMessageCalls[0].forceRefresh, false);

  await refreshButton.dispatchEvent({ type: "click" });
  await new Promise((resolve) => setImmediate(resolve));

  root = document.getElementById("sakura-checker-result");
  refreshButton = findFirstByTag(root, "button");
  const scoreText = findByClass(root, "sc-score-text");

  assert.equal(sendMessageCalls.length, 2);
  assert.equal(sendMessageCalls[1].forceRefresh, true);
  assert.ok(scoreText);
  assert.equal(scoreText.textContent, "4.70");
  assert.equal(refreshButton, null);
});

test("UiDisplay renders the Sakura Checker link as an icon button", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderSuccess({
    ok: true,
    cached: true,
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
    score: {
      kind: "text",
      value: "4.29",
      suffix: "/5",
    },
    verdict: {
      kind: "text-verdict",
      lines: ["合格", "サクラ度 0%"],
    },
  });

  const root = document.getElementById("sakura-checker-result");
  const link = findFirst(root, (element) => element.tagName === "A");

  assert.ok(link);
  assert.equal(link.textContent, "🔗");
  assert.equal(link.className, "sc-link sc-icon-link");
  assert.equal(link.getAttribute("aria-label"), "サクラチェッカーを開く");
  assert.equal(link.title, "サクラチェッカーを開く");
});

test("UiDisplay renders a cached-status indicator with tooltip guidance", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderSuccess({
    ok: true,
    cached: true,
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
    score: {
      kind: "text",
      value: "4.29",
      suffix: "/5",
    },
    verdict: {
      kind: "text-verdict",
      lines: ["合格", "サクラ度 0%"],
    },
  });

  const root = document.getElementById("sakura-checker-result");
  const indicator = findByClass(root, "sc-status-indicator");

  assert.ok(indicator);
  assert.equal(indicator.textContent, "●");
  assert.equal(indicator.dataset.statusTone, "cached");
  assert.equal(indicator.getAttribute("aria-label"), "キャッシュから表示中");
  assert.match(indicator.title, /緑: 取得成功した最新値/);
  assert.match(indicator.title, /黄: キャッシュから表示した値/);
  assert.match(indicator.title, /赤: 取得に失敗した値/);
});

test("UiDisplay places the status dot above right-aligned action buttons", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderSuccess(
    {
      ok: true,
      cached: true,
      sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
      score: {
        kind: "text",
        value: "4.29",
        suffix: "/5",
      },
      verdict: {
        kind: "text-verdict",
        lines: ["合格", "サクラ度 0%"],
      },
    },
    { onRefresh: () => {} }
  );

  const root = document.getElementById("sakura-checker-result");
  const side = findByClass(root, "sc-side");
  const top = findByClass(side, "sc-side-top");
  const bottom = findByClass(side, "sc-side-bottom");

  assert.ok(side);
  assert.ok(top);
  assert.ok(bottom);
  assert.equal(side.children[0], top);
  assert.equal(side.children[1], bottom);
  assert.ok(findByClass(top, "sc-status-indicator"));
  assert.ok(findFirstByTag(bottom, "button"));
  assert.ok(findFirst(bottom, (element) => element.tagName === "A"));
});

test("UiDisplay renders an error-status indicator in red", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderError({
    ok: false,
    code: "network_error",
    message: "Failed to fetch",
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
  });

  const root = document.getElementById("sakura-checker-result");
  const indicator = findByClass(root, "sc-status-indicator");

  assert.ok(indicator);
  assert.equal(indicator.dataset.statusTone, "error");
  assert.equal(indicator.getAttribute("aria-label"), "取得失敗");
});

test("SakuraChecker keeps the first response when the URL changes to the same ASIN during fetch", async () => {
  const document = createPageDocument("https://www.amazon.co.jp/gp/product/B095JGJCC7");
  const sendMessageCalls = [];
  let resolveResponse = null;
  const chrome = {
    runtime: {
      sendMessage: async (payload) =>
        new Promise((resolve) => {
          sendMessageCalls.push(payload);
          resolveResponse = resolve;
        }),
    },
  };
  const context = createExecutionContext({ document, chrome });

  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");
  loadScript(context, "content/ui-display.js");
  loadScript(context, "content/sakura-checker.js");

  context.window.SakuraChecker.observePageChanges();
  const refreshPromise = context.window.SakuraChecker.refreshForCurrentPage();

  context.document.location = new URL("https://www.amazon.co.jp/dp/B095JGJCC7?th=1");
  context.window.location = context.document.location;
  context.location = context.document.location;
  context.__mutationObservers[0].callback();

  resolveResponse({
    ok: true,
    cached: false,
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
    score: {
      kind: "text",
      value: "4.29",
      suffix: "/5",
    },
    verdict: {
      kind: "text-verdict",
      lines: ["合格", "サクラ度 0%"],
    },
  });

  await refreshPromise;

  const root = document.getElementById("sakura-checker-result");
  assert.ok(root);
  assert.equal(root.dataset.state, "success");
  assert.equal(sendMessageCalls.length, 1);

  const scoreText = findByClass(root, "sc-score-text");
  assert.ok(scoreText);
  assert.equal(scoreText.textContent, "4.29");
});

test("UiDisplay renders text-based itemsearch scores", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B091BGMKYS");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderSuccess({
    ok: true,
    cached: false,
    sourceUrl: "https://sakura-checker.jp/itemsearch/?word=QjA5MUJHTUtZUw==",
    score: {
      kind: "text",
      value: "1.93",
      suffix: "/5",
    },
    verdict: {
      kind: "text-verdict",
      lines: ["危険", "サクラ度 90%"],
    },
  });

  const root = document.getElementById("sakura-checker-result");
  assert.ok(root);
  assert.equal(root.dataset.state, "success");

  const scoreText = findByClass(root, "sc-score-text");
  assert.ok(scoreText);
  assert.equal(scoreText.textContent, "1.93");

  const verdictText = findByClass(root, "sc-verdict-text");
  assert.ok(verdictText);
  assert.deepEqual(getChildNodeTexts(verdictText), ["危険", "🌸 90%"]);
});

test("UiDisplay highlights score and sakura percentage with the accent color", () => {
  const document = createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7");
  const context = createExecutionContext({ document });
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderSuccess({
    ok: true,
    cached: true,
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
    score: {
      kind: "text",
      value: "4.29",
      suffix: "/5",
    },
    verdict: {
      kind: "text-verdict",
      lines: ["合格", "サクラ度 0%"],
    },
  });

  const root = document.getElementById("sakura-checker-result");
  const style = document.getElementById("sakura-checker-style");
  const accentNodes = findAllByClass(root, "sc-accent");
  const verdictText = findByClass(root, "sc-verdict-text");

  assert.ok(style);
  assert.match(style.textContent, /\.sc-score-text\s*\{[\s\S]*color: #e5374f;/);
  assert.match(style.textContent, /\.sc-accent\s*\{[\s\S]*color: #e5374f;/);
  assert.equal(accentNodes.length, 1);
  assert.equal(accentNodes[0].textContent, "0%");
  assert.ok(verdictText);
  assert.deepEqual(getChildNodeTexts(verdictText), ["合格", "🌸 0%"]);
});

test("SakuraChecker does not render or fetch on non-product pages that contain search-result ASINs", async () => {
  const document = createPageDocument("https://www.amazon.co.jp/s?k=keyboard");
  const searchResult = document.createElement("div");
  searchResult.setAttribute("data-asin", "B095JGJCC7");
  document.body.appendChild(searchResult);

  let sendMessageCalled = false;
  const chrome = {
    runtime: {
      sendMessage: async () => {
        sendMessageCalled = true;
        return { ok: true };
      },
    },
  };
  const context = createExecutionContext({ document, chrome });

  loadScript(context, "shared/asin-utils.js");
  loadScript(context, "content/asin-extractor.js");
  loadScript(context, "content/ui-display.js");
  loadScript(context, "content/sakura-checker.js");

  await context.window.SakuraChecker.refreshForCurrentPage();

  assert.equal(sendMessageCalled, false);
  assert.equal(document.getElementById("sakura-checker-result"), null);
});
