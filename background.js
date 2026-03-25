importScripts(
  "background/rendered-score-client.js",
  "background/api-client.js"
);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== "checkSakuraScore") {
    return false;
  }

  self.ApiClient.checkSakuraScore({
    asin: request.asin,
    forceRefresh: request.forceRefresh === true,
  })
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        code: "network_error",
        message: error instanceof Error ? error.message : "Unexpected background error.",
        sourceUrl: self.ApiClient.buildDetailUrl(request.asin),
      });
    });

  return true;
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
