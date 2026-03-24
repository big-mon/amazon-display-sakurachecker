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
