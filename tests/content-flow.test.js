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
  const context = {
    console,
    document: document || createPageDocument("https://www.amazon.co.jp/dp/B095JGJCC7"),
    chrome: chrome || { runtime: { sendMessage: async () => ({ ok: true }) } },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
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
  loadScript(context, "content/ui-display.js");

  context.window.UiDisplay.renderLoading("https://sakura-checker.jp/search/B095JGJCC7/");

  const root = document.getElementById("sakura-checker-result");
  assert.ok(root);
  assert.equal(root.dataset.state, "loading");
  assert.equal(document.body.children[1], root);

  const link = findFirst(root, (element) => element.tagName === "A");
  assert.ok(link);
  assert.equal(link.href, "https://sakura-checker.jp/search/B095JGJCC7/");
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

  loadScript(context, "content/asin-extractor.js");
  loadScript(context, "content/ui-display.js");
  loadScript(context, "content/sakura-checker.js");

  const refreshPromise = context.window.SakuraChecker.refreshForCurrentPage(false);

  const loadingRoot = document.getElementById("sakura-checker-result");
  assert.ok(loadingRoot);
  assert.equal(loadingRoot.dataset.state, "loading");
  assert.ok(resolveResponse);
  assert.equal(resolveResponse.payload.asin, "B095JGJCC7");

  resolveResponse.resolve({
    ok: true,
    cached: false,
    sourceUrl: "https://sakura-checker.jp/search/B095JGJCC7/",
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
