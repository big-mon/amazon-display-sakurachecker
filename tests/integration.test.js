const test = require("node:test");
const assert = require("node:assert/strict");

const apiClient = require("../background/api-client.js");

const knownAsins = ["B08N5WRWNW", "B0921THFXZ", "B0CP4V4RPL"];

function liveFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options && options.headers ? options.headers : {}),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });
}

for (const asin of knownAsins) {
  test(`live fetch returns a visual score for ${asin}`, async () => {
    const result = await apiClient.checkSakuraScore({
      asin,
      forceRefresh: true,
      fetchImpl: liveFetch,
    });

    assert.equal(result.ok, true);
    assert.equal(result.score.kind, "visual-image");
    assert.ok(result.score.images.length >= 1);

    for (const image of result.score.images) {
      assert.match(image.src, /^data:image\/png;base64,/);
    }
  });
}
