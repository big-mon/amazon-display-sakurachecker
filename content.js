(function () {
  function initialize() {
    if (!window.SakuraChecker) {
      return;
    }

    window.SakuraChecker.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
