const test = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

const fixtures = require("./fixtures.js");
const renderedParser = require("../background/rendered-score-parser.js");

function parseDocument(html, url = "https://sakura-checker.jp/search/B08N5WRWNW/") {
  const { document, window } = parseHTML(html);
  Object.defineProperty(document, "baseURI", {
    configurable: true,
    value: url,
  });
  if (window && window.history && typeof window.history.replaceState === "function") {
    window.history.replaceState({}, "", url);
  }
  return document;
}

test("extractRenderedScore reads the legacy /5 product card with verdict", () => {
  const document = parseDocument(fixtures.realisticPageHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.equal(result.score.images.length, 2);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level03.png");
});

test("extractRenderedScore prefers the richest rendered product card", () => {
  const document = parseDocument(fixtures.comparisonHeavyProductHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["score", "other", "plus"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level01.png");
});

test("extractRenderedScore filters legacy cards by the requested ASIN", () => {
  const document = parseDocument(fixtures.targetedRenderedProductHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["target-digit"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level03.png");
});

test("extractRenderedScore waits when only unrelated legacy cards are rendered for the requested ASIN", () => {
  const document = parseDocument(fixtures.targetedRenderedLoadingHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore falls back to the rendered modern summary when needed", () => {
  const document = parseDocument(fixtures.renderedModernHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "%");
  assert.equal(result.score.images.length, 1);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/sakura_lv00.png");
});

test("extractRenderedScore reports blocked for rate-limit or captcha pages", () => {
  const document = parseDocument(
    fixtures.renderedBlockedHtml,
    "https://sakura-checker.jp/error/accessdenied/"
  );
  const result = renderedParser.extractRenderedScore(document, "B08N5WRWNW");

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
  assert.equal(result.retryable, false);
});

test("extractRenderedScore reports not_ready while the rendered card is still loading", () => {
  const document = parseDocument(fixtures.renderedLoadingHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore reports parse_error for unrelated markup", () => {
  const document = parseDocument("<!DOCTYPE html><html><body><p>No score here.</p></body></html>");
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, false);
  assert.equal(result.code, "parse_error");
  assert.equal(result.retryable, false);
});
