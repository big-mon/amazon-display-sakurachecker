(function () {
  const asinUtils = window.AsinUtils;
  const UNSUPPORTED_SECTION_PATTERNS = [
    /^\/gp\/video(?:\/|$)/i,
    /^\/(?:prime-video|Prime-Video)(?:\/|$)/i,
    /^\/music\/player(?:\/|$)/i,
    /^\/gp\/dmusic(?:\/|$)/i,
  ];

  if (!asinUtils) {
    throw new Error("AsinUtils is not available.");
  }

  function isUnsupportedSectionPath(pathname) {
    return UNSUPPORTED_SECTION_PATTERNS.some((pattern) => pattern.test(String(pathname || "")));
  }

  function extractProductASIN() {
    if (isUnsupportedSectionPath(window.location.pathname)) {
      return null;
    }

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
