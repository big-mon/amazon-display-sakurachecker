(function () {
  class SakuraCheckerController {
    constructor() {
      this.currentAsin = null;
      this.inFlight = false;
    }

    init() {
      this.refreshForCurrentPage();
      this.observePageChanges();
    }

    async refreshForCurrentPage() {
      if (!window.AsinExtractor || !window.UiDisplay) {
        return;
      }

      if (!window.AsinExtractor.isProductPage()) {
        window.UiDisplay.remove();
        this.currentAsin = null;
        return;
      }

      const asin = window.AsinExtractor.extractProductASIN();
      if (!asin || this.inFlight) {
        if (!asin) {
          window.UiDisplay.remove();
          this.currentAsin = null;
        }
        return;
      }

      this.currentAsin = asin;
      this.inFlight = true;
      window.UiDisplay.renderLoading(`https://sakura-checker.jp/search/${asin}/`);

      try {
        const response = await chrome.runtime.sendMessage({
          action: "checkSakuraScore",
          asin,
        });

        if (asin !== this.currentAsin) {
          return;
        }

        if (response && response.ok) {
          window.UiDisplay.renderSuccess(response);
        } else {
          window.UiDisplay.renderError(response);
        }
      } catch (error) {
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
      }
    }

    observePageChanges() {
      let previousUrl = window.location.href;
      const observer = new MutationObserver(() => {
        if (window.location.href !== previousUrl) {
          previousUrl = window.location.href;
          this.currentAsin = null;
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
