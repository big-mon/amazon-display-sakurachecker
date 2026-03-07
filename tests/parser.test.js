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
});

test("extractInjectedHtmlSnippets decodes nested inline script payloads", () => {
  const snippets = parser.extractInjectedHtmlSnippets(fixtures.htmlWithInjectedScore);

  assert.equal(snippets.length, 1);
  assert.match(snippets[0], /item-review-level/);
  assert.match(snippets[0], /Amazonと同等のスコア/);
});

test("parseVisualScore prefers the injected main score markup", () => {
  const result = parser.parseVisualScore(fixtures.htmlWithInjectedScore, "B08N5WRWNW");

  assert.equal(result.ok, true);
  assert.equal(result.score.images.length, 2);
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["score", "other"]
  );
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
