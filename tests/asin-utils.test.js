const test = require("node:test");
const assert = require("node:assert/strict");

const asinUtils = require("../shared/asin-utils.js");

test("extractAsinFromPath supports Amazon product URL variants", () => {
  assert.equal(asinUtils.extractAsinFromPath("/dp/B095JGJCC7"), "B095JGJCC7");
  assert.equal(asinUtils.extractAsinFromPath("/gp/product/B095JGJCC7/"), "B095JGJCC7");
  assert.equal(asinUtils.extractAsinFromPath("/gp/aw/d/B095JGJCC7"), "B095JGJCC7");
});

test("extractAsinFromUrl parses canonical and mobile product URLs", () => {
  assert.equal(
    asinUtils.extractAsinFromUrl("https://www.amazon.co.jp/gp/aw/d/B095JGJCC7?smid=test"),
    "B095JGJCC7"
  );
  assert.equal(
    asinUtils.extractAsinFromUrl("https://www.amazon.co.jp/gp/product/B095JGJCC7/ref=something"),
    "B095JGJCC7"
  );
});

test("extractAsinFromUrl rejects an Amazon-shaped path on an external host", () => {
  assert.equal(
    asinUtils.extractAsinFromUrl("https://evil.example/dp/B095JGJCC7"),
    null
  );
});

test("extractAsinFromUrl requires HTTPS Amazon origin and supports relative product URLs", () => {
  assert.equal(
    asinUtils.extractAsinFromUrl("https://www.amazon.co.jp/dp/B095JGJCC7"),
    "B095JGJCC7"
  );
  assert.equal(
    asinUtils.extractAsinFromUrl("/dp/B095JGJCC7?ref_=さくら"),
    "B095JGJCC7"
  );
  assert.equal(
    asinUtils.extractAsinFromUrl("http://www.amazon.co.jp/dp/B095JGJCC7"),
    null
  );
  assert.equal(
    asinUtils.extractAsinFromUrl("https://[invalid/dp/B095JGJCC7"),
    null
  );
});
