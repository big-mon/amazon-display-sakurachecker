(function (root, factory) {
  const exportsObject = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.AsinUtils = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const PRODUCT_PATH_PATTERN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/i;

  function extractAsinFromPath(path) {
    const match = String(path || "").match(PRODUCT_PATH_PATTERN);
    return match ? match[1].toUpperCase() : null;
  }

  function extractAsinFromUrl(urlValue) {
    if (!urlValue) {
      return null;
    }

    try {
      const parsed = new URL(urlValue, "https://www.amazon.co.jp");
      return extractAsinFromPath(parsed.pathname);
    } catch {
      return extractAsinFromPath(urlValue);
    }
  }

  return {
    extractAsinFromPath,
    extractAsinFromUrl,
  };
});
