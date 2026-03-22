(function () {
  const PRODUCT_PATH_PATTERN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/i;

  function extractAsinFromPath(path) {
    const match = String(path || "").match(PRODUCT_PATH_PATTERN);
    return match ? match[1].toUpperCase() : null;
  }

  function extractProductASIN() {
    const pathAsin = extractAsinFromPath(window.location.pathname);
    if (pathAsin) {
      return pathAsin;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    const canonicalHref = canonical && canonical.getAttribute("href");
    if (canonicalHref) {
      const canonicalAsin = extractAsinFromPath(canonicalHref);
      if (canonicalAsin) {
        return canonicalAsin;
      }
    }

    return null;
  }

  function buildAmazonUrl(asin) {
    return `https://www.amazon.co.jp/dp/${asin}`;
  }

  function isProductPage() {
    return Boolean(extractProductASIN());
  }

  window.AsinExtractor = {
    buildAmazonUrl,
    extractProductASIN,
    isProductPage,
  };
})();
