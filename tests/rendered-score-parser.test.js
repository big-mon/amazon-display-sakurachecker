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

function parseLegacyImageCard(scoreSrc, verdictSrc = "/images/rv_level03.png") {
  return parseDocument(`
    <div class="item-review-wrap">
      <div class="item-info">
        <div class="item-review-box">
          <div class="item-review-after">
            <p class="item-rating"><span><img src="${scoreSrc}" alt="score"></span>/5</p>
          </div>
          <div class="item-review-level">
            <p class="item-rv-lv"><img src="${verdictSrc}" alt="verdict"></p>
            <p class="item-rv-score">Amazonと同等のスコア</p>
          </div>
        </div>
      </div>
    </div>
  `);
}

test("extractRenderedScore rejects an external rendered-card score image", () => {
  const document = parseLegacyImageCard("https://tracker.invalid/pixel.png");
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, false);
  assert.equal(result.score, undefined);
});

test("extractRenderedScore filters unsafe image URLs and normalizes supported Sakura URLs", () => {
  const rejectedUrls = [
    "//tracker.invalid/pixel.png",
    "http://sakura-checker.jp/images/score.png",
    "javascript:alert(1)",
    "blob:https://sakura-checker.jp/image-id",
    "chrome-extension://unsafe/image.png",
    "data:text/html,%3Csvg%3E",
    "http://[invalid",
    "",
  ];

  for (const rejectedUrl of rejectedUrls) {
    const result = renderedParser.extractRenderedScore(parseLegacyImageCard(rejectedUrl));
    assert.equal(result.ok, false, rejectedUrl || "empty URL");
  }

  const acceptedUrls = [
    ["data:image/png;base64,AAAA", "data:image/png;base64,AAAA"],
    ["data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"],
    ["/images/score.png", "https://sakura-checker.jp/images/score.png"],
    ["//sakura-checker.jp/images/score.png", "https://sakura-checker.jp/images/score.png"],
    ["https://sakura-checker.jp/images/score.png", "https://sakura-checker.jp/images/score.png"],
  ];

  for (const [sourceUrl, expectedUrl] of acceptedUrls) {
    const result = renderedParser.extractRenderedScore(parseLegacyImageCard(sourceUrl));
    assert.equal(result.ok, true, sourceUrl);
    assert.equal(result.score.images[0].src, expectedUrl);
    assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level03.png");
  }
});

test("extractRenderedScore keeps a legacy /5 score retryable when any score image is unsafe", () => {
  const document = parseDocument(`
    <div class="item-review-wrap">
      <div class="item-info">
        <div class="item-review-box">
          <div class="item-review-after">
            <p class="item-rating"><span>
              <img src="data:image/png;base64,SAFE-1" alt="safe-1">
              <img src="https://tracker.invalid/pixel.png" alt="unsafe">
              <img src="data:image/png;base64,SAFE-2" alt="safe-2">
            </span>/5</p>
          </div>
          <div class="item-review-level">
            <p class="item-rv-score">Amazonと同等のスコア</p>
          </div>
        </div>
      </div>
    </div>
  `);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore omits an unsafe verdict image while preserving safe score content", () => {
  const result = renderedParser.extractRenderedScore(
    parseLegacyImageCard("data:image/png;base64,AAAA", "https://tracker.invalid/verdict.png")
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.score.images, [
    { src: "data:image/png;base64,AAAA", alt: "score" },
  ]);
  assert.deepEqual(result.verdict, {
    kind: "text-verdict",
    lines: ["Amazonと同等のスコア"],
  });
});

test("extractRenderedScore reads the legacy /5 product card with verdict", () => {
  const document = parseDocument(fixtures.realisticPageHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.equal(result.score.images.length, 2);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level03.png");
});

test("extractRenderedScore reads the itemsearch row for the requested ASIN", () => {
  const document = parseDocument(
    fixtures.itemSearchResultHtml,
    "https://sakura-checker.jp/itemsearch/?word=QjA5MUJHTUtZUw=="
  );
  const result = renderedParser.extractRenderedScore(document, "B091BGMKYS");

  assert.equal(result.ok, true);
  assert.equal(result.score.kind, "text");
  assert.equal(result.score.value, "1.93");
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(result.verdict.lines, ["危険", "サクラ度 90%"]);
});

test("extractRenderedScore reports when itemsearch asks for an Amazon product URL", () => {
  const document = parseDocument(
    fixtures.itemSearchNoResultsHtml,
    "https://sakura-checker.jp/itemsearch/?word=QjBCSkRZNkQxVw=="
  );
  const result = renderedParser.extractRenderedScore(document, "B0BJDY6D1W");

  assert.equal(result.ok, false);
  assert.equal(result.code, "url_search_required");
  assert.equal(result.retryable, false);
});

test("extractRenderedScore falls back to the product detail page when itemsearch only exposes a detail link", () => {
  const document = parseDocument(
    fixtures.itemSearchDetailLinkOnlyHtml,
    "https://sakura-checker.jp/itemsearch/?word=QjBENVJKNUJEWA=="
  );
  const result = renderedParser.extractRenderedScore(document, "B0D5RJ5BDX");

  assert.equal(result.ok, false);
  assert.equal(result.code, "url_search_required");
  assert.equal(result.retryable, false);
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

test("extractRenderedScore does not treat sibling cards as ASIN matches via the wrapper link", () => {
  const document = parseDocument(fixtures.wrapperScopedLegacyHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["target-only"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level03.png");
});

test("extractRenderedScore preserves the best legacy card when wrapper-scoped siblings are ambiguous and no modern summary exists", () => {
  const document = parseDocument(fixtures.sameWrapReviewCountTiebreakHtml);
  const result = renderedParser.extractRenderedScore(document, "B095JGJCC7");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["distinct-large", "separator", "distinct-wide", "distinct-medium", "distinct-tail"]
  );
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level01.png");
});

test("extractRenderedScore uses the visible card when hidden comparison cards share the requested wrapper", () => {
  const hiddenComparisonImage = fixtures.sampleImageTag.replace(
    'alt="score"',
    'alt="hidden-score"'
  );
  const visibleTargetImage = fixtures.sampleImageTag.replace(
    'alt="score"',
    'alt="visible-target"'
  );
  const document = parseDocument(`
    <!DOCTYPE html>
    <html lang="ja">
      <body>
        <div class="item-review-wrap">
          <div class="item-image">
            <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22"></a>
          </div>
          <div class="item-info hidden-comparison" style="display: none;">
            <div class="item-review-box">
              <div class="item-review-after">
                <p class="item-rating"><span>${hiddenComparisonImage}</span>/5</p>
              </div>
              <div class="item-review-level">
                <p class="item-rv-lv"><img src="/images/rv_level04.png" alt="hidden verdict"></p>
                <p class="item-rv-score">Hidden comparison score</p>
              </div>
            </div>
          </div>
          <div class="item-info visible-target">
            <div class="item-review-box">
              <div class="item-review-after">
                <p class="item-rating"><span>${visibleTargetImage}</span>/5</p>
              </div>
              <div class="item-review-level">
                <p class="item-rv-lv"><img src="/images/rv_level01.png" alt="visible verdict"></p>
                <p class="item-rv-score">Visible target score</p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "/5");
  assert.deepEqual(
    result.score.images.map((image) => image.alt),
    ["visible-target"]
  );
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/rv_level01.png");
});

test("extractRenderedScore waits for hidden requested legacy cards before using a modern summary", () => {
  const hiddenTargetImage = fixtures.sampleImageTag.replace(
    'alt="score"',
    'alt="hidden-target"'
  );
  const hiddenComparisonImage = fixtures.sampleImageTag.replace(
    'alt="score"',
    'alt="hidden-comparison"'
  );
  const document = parseDocument(`
    <!DOCTYPE html>
    <html lang="ja">
      <body>
        <div class="item-review-wrap">
          <div class="item-image">
            <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22"></a>
          </div>
          <div class="item-info hidden-target" style="display: none;">
            <div class="item-review-box">
              <div class="item-review-after">
                <p class="item-rating"><span>${hiddenTargetImage}</span>/5</p>
              </div>
              <div class="item-review-level">
                <p class="item-rv-score">Hidden target score</p>
              </div>
            </div>
          </div>
          <div class="item-info hidden-comparison" style="display: none;">
            <div class="item-review-box">
              <div class="item-review-after">
                <p class="item-rating"><span>${hiddenComparisonImage}</span>/5</p>
              </div>
              <div class="item-review-level">
                <p class="item-rv-score">Hidden comparison score</p>
              </div>
            </div>
          </div>
        </div>
        <div class="sakuraBlock">
          ${fixtures.modernSakuraAlertMarkup}
          ${fixtures.modernSakuraRatingMarkup}
        </div>
      </body>
    </html>
  `);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore waits when the only requested legacy card is hidden", () => {
  const hiddenTargetImage = fixtures.sampleImageTag.replace(
    'alt="score"',
    'alt="hidden-target"'
  );
  const document = parseDocument(`
    <!DOCTYPE html>
    <html lang="ja">
      <body>
        <div class="item-review-wrap">
          <div class="item-image">
            <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22"></a>
          </div>
          <div class="item-info hidden-target" style="display: none;">
            <div class="item-review-box">
              <div class="item-review-after">
                <p class="item-rating"><span>${hiddenTargetImage}</span>/5</p>
              </div>
              <div class="item-review-level">
                <p class="item-rv-score">Hidden target score</p>
              </div>
            </div>
          </div>
        </div>
        <div class="sakuraBlock">
          ${fixtures.modernSakuraAlertMarkup}
          ${fixtures.modernSakuraRatingMarkup}
        </div>
      </body>
    </html>
  `);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore falls back to the modern summary when wrapper-scoped legacy siblings are ambiguous", () => {
  const document = parseDocument(fixtures.ambiguousWrapperWithModernHtml);
  const result = renderedParser.extractRenderedScore(document, "B095JGJCC7");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "%");
  assert.equal(result.score.images.length, 1);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/sakura_lv00.png");
});

test("extractRenderedScore waits when only unrelated legacy cards are rendered for the requested ASIN", () => {
  const document = parseDocument(fixtures.targetedRenderedLoadingHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore keeps retrying when a target card has a loader and only a loading verdict", () => {
  const document = parseDocument(fixtures.targetedRenderedLoadingWithVerdictHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore reports not_available for a rendered product card without any score", () => {
  const document = parseDocument(fixtures.targetedUnavailableProductHtml);
  const result = renderedParser.extractRenderedScore(document, "B0CPS3DZ3H");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_available");
  assert.equal(result.retryable, false);
});

test("extractRenderedScore propagates not_available from ambiguous wrapper-scoped matches", () => {
  const document = parseDocument(fixtures.wrapperScopedUnavailableLegacyHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_available");
  assert.equal(result.retryable, false);
});

test("extractRenderedScore does not let a sibling loader hide an exact unavailable target card", () => {
  const document = parseDocument(fixtures.wrapperScopedExactUnavailableWithSiblingLoaderHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_available");
  assert.equal(result.retryable, false);
});

test("extractRenderedScore prefers the modern summary over a pending legacy card", () => {
  const document = parseDocument(fixtures.targetedRenderedLoadingWithModernHtml);
  const result = renderedParser.extractRenderedScore(document, "B0TARGET42");

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "%");
  assert.equal(result.score.images.length, 1);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/sakura_lv00.png");
});

test("extractRenderedScore keeps a modern multi-image score retryable when any score image is unsafe", () => {
  const document = parseDocument(`
    <div class="sakuraBlock">
      <p class="sakura-alert">
        サクラ度は
        <span class="sakura-num">
          <img src="data:image/png;base64,SAFE-1" alt="safe-1">
          <img src="https://tracker.invalid/pixel.png" alt="unsafe">
          <img src="data:image/png;base64,SAFE-2" alt="safe-2">
        </span>
      </p>
    </div>
  `);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_ready");
  assert.equal(result.retryable, true);
});

test("extractRenderedScore falls back to the rendered modern summary when needed", () => {
  const document = parseDocument(fixtures.fixedRenderedModernHtml);
  const result = renderedParser.extractRenderedScore(document);

  assert.equal(result.ok, true);
  assert.equal(result.score.suffix, "%");
  assert.equal(result.score.images.length, 1);
  assert.ok(result.verdict);
  assert.equal(result.verdict.image.src, "https://sakura-checker.jp/images/sakura_lv00.png");
});

test("extractRenderedScore can use the modern summary even when unrelated legacy cards exist", () => {
  const document = parseDocument(
    fixtures.fixedRenderedModernWithUnrelatedLegacyHtml,
    "https://sakura-checker.jp/search/B0MODERN42/"
  );
  const result = renderedParser.extractRenderedScore(document, "B0MODERN42");

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
