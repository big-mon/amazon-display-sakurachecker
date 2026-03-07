(function () {
  function extractProductASIN() {
    const urlMatch = window.location.pathname.match(
      /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i
    );
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    const canonicalHref = canonical && canonical.getAttribute("href");
    if (canonicalHref) {
      const canonicalMatch = canonicalHref.match(
        /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i
      );
      if (canonicalMatch) {
        return canonicalMatch[1].toUpperCase();
      }
    }

    const dataAsin = document.querySelector("[data-asin]");
    const asinValue = dataAsin && dataAsin.getAttribute("data-asin");
    if (asinValue && /^[A-Z0-9]{10}$/i.test(asinValue)) {
      return asinValue.toUpperCase();
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
