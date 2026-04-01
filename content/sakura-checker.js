(function () {
  class SakuraCheckerController {
    constructor() {
      this.currentAsin = null;
      this.inFlight = false;
      this.pendingRefresh = false;
      this.pendingForceRefresh = false;
    }

    init() {
      this.refreshForCurrentPage();
      this.observePageChanges();
    }

    getCurrentPageAsin() {
      if (!window.AsinExtractor || !window.AsinExtractor.isProductPage()) {
        return null;
      }

      return window.AsinExtractor.extractProductASIN();
    }

    getCurrentProductTitle() {
      const titleNode = document.querySelector("#productTitle");
      const rawTitle = titleNode ? titleNode.textContent : "";
      const normalizedTitle = String(rawTitle || "").replace(/\s+/g, " ").trim();
      return normalizedTitle || null;
    }

    getCurrentProductUrl(asin) {
      const canonical = document.querySelector('link[rel="canonical"]');
      const canonicalHref = canonical && canonical.getAttribute("href");
      if (canonicalHref) {
        return canonicalHref;
      }

      return asin ? `https://www.amazon.co.jp/dp/${asin}` : null;
    }

    async refreshForCurrentPage({ forceRefresh = false } = {}) {
      if (!window.AsinExtractor || !window.UiDisplay) {
        return;
      }

      const asin = this.getCurrentPageAsin();
      if (!asin) {
        window.UiDisplay.remove();
        this.currentAsin = null;
        this.pendingRefresh = false;
        this.pendingForceRefresh = false;
        return;
      }

      if (this.inFlight) {
        this.pendingRefresh = true;
        this.pendingForceRefresh = this.pendingForceRefresh || forceRefresh;
        return;
      }

      this.currentAsin = asin;
      this.inFlight = true;
      this.pendingRefresh = false;
      this.pendingForceRefresh = false;
      window.UiDisplay.renderLoading(`https://sakura-checker.jp/search/${asin}/`);
      const productTitle = this.getCurrentProductTitle();
      const productUrl = this.getCurrentProductUrl(asin);
      let latestAsin = asin;

      try {
        const response = await chrome.runtime.sendMessage({
          action: "checkSakuraScore",
          asin,
          forceRefresh,
          productTitle,
          productUrl,
        });

        latestAsin = this.getCurrentPageAsin();
        if (latestAsin !== asin) {
          return;
        }

        if (response && response.ok) {
          window.UiDisplay.renderSuccess(response, {
            onRefresh:
              response.cached
                ? () => {
                    this.refreshForCurrentPage({ forceRefresh: true });
                  }
                : null,
          });
        } else {
          window.UiDisplay.renderError(response);
        }
      } catch (error) {
        latestAsin = this.getCurrentPageAsin();
        if (latestAsin !== asin) {
          return;
        }

        window.UiDisplay.renderError(
          {
            ok: false,
            code: "network_error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to talk to the background service worker.",
            sourceUrl: `https://sakura-checker.jp/search/${asin}/`,
          }
        );
      } finally {
        this.inFlight = false;
        const pendingForceRefresh = this.pendingForceRefresh;
        const shouldRetry =
          this.pendingRefresh &&
          (latestAsin !== asin || !document.getElementById("sakura-checker-result"));
        this.pendingRefresh = false;
        this.pendingForceRefresh = false;
        if (shouldRetry) {
          this.refreshForCurrentPage({ forceRefresh: pendingForceRefresh });
        }
      }
    }

    observePageChanges() {
      let previousUrl = window.location.href;
      const observer = new MutationObserver(() => {
        if (window.location.href !== previousUrl) {
          previousUrl = window.location.href;
          this.refreshForCurrentPage();
          return;
        }

        if (this.currentAsin && !document.getElementById("sakura-checker-result")) {
          this.refreshForCurrentPage();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  window.SakuraChecker = new SakuraCheckerController();
})();
