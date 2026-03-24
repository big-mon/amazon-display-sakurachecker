(function () {
  class SakuraCheckerController {
    constructor() {
      this.currentAsin = null;
      this.inFlight = false;
      this.pendingRefresh = false;
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

    async refreshForCurrentPage() {
      if (!window.AsinExtractor || !window.UiDisplay) {
        return;
      }

      const asin = this.getCurrentPageAsin();
      if (!asin) {
        window.UiDisplay.remove();
        this.currentAsin = null;
        this.pendingRefresh = false;
        return;
      }

      if (this.inFlight) {
        this.pendingRefresh = true;
        return;
      }

      this.currentAsin = asin;
      this.inFlight = true;
      this.pendingRefresh = false;
      window.UiDisplay.renderLoading(`https://sakura-checker.jp/search/${asin}/`);
      let latestAsin = asin;

      try {
        const response = await chrome.runtime.sendMessage({
          action: "checkSakuraScore",
          asin,
        });

        latestAsin = this.getCurrentPageAsin();
        if (latestAsin !== asin) {
          return;
        }

        if (response && response.ok) {
          window.UiDisplay.renderSuccess(response);
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
        const shouldRetry =
          this.pendingRefresh &&
          (latestAsin !== asin || !document.getElementById("sakura-checker-result"));
        this.pendingRefresh = false;
        if (shouldRetry) {
          this.refreshForCurrentPage();
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
