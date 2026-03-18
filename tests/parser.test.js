const test = require("node:test");
const assert = require("node:assert/strict");

const parser = require("../background/score-parser.js");
const fixtures = require("./fixtures.js");

test("decodeObfuscatedImageTag restores a data URL", () => {
  const decoded = parser.decodeObfuscatedImageTag(fixtures.sampleImageTag);

  assert.ok(decoded);
  assert.match(decoded.src, /^data:image\/png;base64,/);
  assert.equal(decoded.alt, "score");
});

test("parseVisualScore selects the block matching the requested ASIN", () => {
  const result = parser.parseVisualScore(fixtures.sampleHtml, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.images.length, 1);
  assert.equal(result.score.suffix, "/5");
  assert.equal(result.score.images[0].alt, "score");
  assert.ok(result.verdict);
  assert.equal(result.verdict.kind, "visual-verdict");
  assert.equal(result.verdict.image.src, "/images/rv_level03.png");
  assert.equal(result.verdict.lines.length, 2);
});

test("extractInjectedHtmlSnippets decodes nested inline script payloads", () => {
  const snippets = parser.extractInjectedHtmlSnippets(fixtures.htmlWithInjectedScore);

  assert.equal(snippets.length, 1);
  assert.match(snippets[0], /item-review-level/);
  assert.match(snippets[0], /item-rating/);
});

test("parseVisualScore prefers the injected main score markup", () => {
  const result = parser.parseVisualScore(fixtures.htmlWithInjectedScore, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.images.length, 2);
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["score", "other"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.kind, "visual-verdict");
  assert.equal(result.verdict.image.src, "/images/rv_level03.png");
  assert.equal(result.verdict.lines.length, 2);
});

test("parseVisualScore prefers the modern injected sakura score markup", () => {
  const result = parser.parseVisualScore(fixtures.modernInjectedHtml, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.images.length, 1);
  assert.equal(result.score.suffix, "%");
  assert.equal(result.score.images[0].alt, "score");
  assert.ok(result.verdict);
  assert.equal(result.verdict.kind, "visual-verdict");
  assert.equal(result.verdict.image.src, "/images/sakura_lv00.png");
  assert.deepEqual(result.verdict.lines, ["安全な商品です！"]);
});

test("parseVisualScore prefers the product card over the modern sakura summary", () => {
  const result = parser.parseVisualScore(fixtures.productAndModernHtml, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.equal(result.score.images.length, 1);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "/images/rv_level03.png");
});

test("parseVisualScore returns not_found when no matching ASIN exists", () => {
  const result = parser.parseVisualScore(fixtures.sampleHtml, "B111111111");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_found");
});

test("parseVisualScore returns parse_error when rating markup is missing", () => {
  const brokenTarget = fixtures.targetReviewWrap.replace(
    '<p class="item-rating"><span>',
    '<p class="missing-rating"><span>'
  );
  const brokenHtml = `
    <!DOCTYPE html>
    <html lang="ja">
      <body>
        ${fixtures.otherReviewWrap}
        ${brokenTarget}
        <p class="item-btn"><a href="https://www.amazon.co.jp/dp/B08N5WRWNW/?tag=sakurachecker-22"></a></p>
      </body>
    </html>
  `;
  const result = parser.parseVisualScore(brokenHtml, "B08N5WRWNW");

  assert.equal(result.ok, false);
  assert.equal(result.code, "parse_error");
});

test("parseVisualScore keeps score when the verdict block is missing", () => {
  const targetWithoutVerdict = fixtures.targetReviewWrap.replace(
    /<div class="item-review-level">[\s\S]*?<\/div>\s*/,
    ""
  );
  const htmlWithoutVerdict = fixtures.sampleHtml.replace(
    fixtures.targetReviewWrap,
    targetWithoutVerdict
  );

  const result = parser.parseVisualScore(htmlWithoutVerdict, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.images.length, 1);
  assert.equal(result.verdict, null);
});

test("parseVisualScore handles a realistic page shape with gp/product links", () => {
  const result = parser.parseVisualScore(fixtures.realisticPageHtml, "B095JGJCC7");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.images.length, 2);
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["score", "other"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.kind, "visual-verdict");
  assert.equal(result.verdict.image.src, "/images/rv_level03.png");
  assert.deepEqual(result.verdict.lines, ["Amazonより", "危険なスコア"]);
});

test("parseVisualScore combines repeated rating markups when no verdict block exists", () => {
  const result = parser.parseVisualScore(fixtures.multiRatingNoVerdictHtml, "B0MULTI123");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.images.length, 3);
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["digit-1", "digit-2", "digit-3"]
  );
  assert.equal(result.verdict, null);
});

test("parseVisualScore chooses the richest item-info card within a product block", () => {
  const result = parser.parseVisualScore(fixtures.comparisonHeavyProductHtml, "B0COMPARE1");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "visual-image");
  assert.equal(result.score.suffix, "/5");
  assert.equal(result.score.images.length, 3);
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["score", "other", "plus"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "/images/rv_level01.png");
  assert.deepEqual(result.verdict.lines, ["Amazonと", "同等のスコア"]);
});
