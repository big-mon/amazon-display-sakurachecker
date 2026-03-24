(function () {
  const asinUtils = window.AsinUtils;

  if (!asinUtils) {
    throw new Error("AsinUtils is not available.");
  }

  function extractProductASIN() {
    const pathAsin = asinUtils.extractAsinFromPath(window.location.pathname);
    if (pathAsin) {
      return pathAsin;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    const canonicalHref = canonical && canonical.getAttribute("href");
    if (canonicalHref) {
      const canonicalAsin = asinUtils.extractAsinFromUrl(canonicalHref);
      if (canonicalAsin) {
        return canonicalAsin;
      }
    }

    return null;
  }

  function isProductPage() {
    return Boolean(extractProductASIN());
  }

  window.AsinExtractor = {
    extractProductASIN,
    isProductPage,
  };
})();
