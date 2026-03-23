(function (root, factory) {
  const exportsObject = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.RenderedScoreParser = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function () {
  function extractRenderedScore(rootNodeOrAsin, maybeRequestedAsin) {
    const root =
      rootNodeOrAsin && typeof rootNodeOrAsin.querySelector === "function"
        ? rootNodeOrAsin
        : (typeof document !== "undefined" ? document : null);
    const requestedAsin =
      root === rootNodeOrAsin ? maybeRequestedAsin : rootNodeOrAsin;

    if (!root || typeof root.querySelector !== "function") {
      return {
        ok: false,
        code: "parse_error",
        message: "A DOM root is required to extract the rendered Sakura Checker score.",
        retryable: false,
      };
    }

    function normalizeText(value) {
      return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function resolveUrl(value) {
      if (!value) {
        return value;
      }

      if (/^(?:data:|https?:|chrome-extension:)/i.test(value)) {
        return value;
      }

      const baseUrl =
        root.baseURI ||
        ((root.location && root.location.href) || null) ||
        (typeof location !== "undefined" ? location.href : null);

      if (!baseUrl) {
        return value;
      }

      try {
        return new URL(value, baseUrl).toString();
      } catch {
        return value;
      }
    }

    function getImagePayload(image) {
      if (!image) {
        return null;
      }

      const src = resolveUrl(image.src || image.getAttribute("src") || "");
      if (!src) {
        return null;
      }

      return {
        src,
        alt: image.getAttribute("alt") || image.alt || "",
      };
    }

    function getRatingImages(ratingNodes) {
      const imageGroups = Array.from(ratingNodes, (ratingNode) =>
        Array.from(ratingNode.querySelectorAll("img"))
          .map(getImagePayload)
          .filter(Boolean)
      ).filter((group) => group.length);

      if (!imageGroups.length) {
        return [];
      }

      const richestGroup = imageGroups.reduce((bestGroup, currentGroup) =>
        currentGroup.length > bestGroup.length ? currentGroup : bestGroup
      );

      if (richestGroup.length > 1) {
        return richestGroup;
      }

      if (imageGroups.length > 1) {
        return imageGroups.flat();
      }

      return richestGroup;
    }

    function getVerdictLines(node) {
      if (!node) {
        return [];
      }

      return node.innerHTML
        .split(/<br\s*\/?>/i)
        .map((segment) => normalizeText(segment.replace(/<[^>]+>/g, " ")))
        .filter(Boolean);
    }

    function buildRequestedAsinPattern() {
      if (!requestedAsin) {
        return null;
      }

      return new RegExp(
        `(?:/dp/|/gp/product/|/search/|\\b)${requestedAsin}(?:[/?#&]|$)`,
        "i"
      );
    }

    const requestedAsinPattern = buildRequestedAsinPattern();

    function anchorMatchesRequestedAsin(anchor) {
      if (!requestedAsinPattern || !anchor) {
        return false;
      }

      return requestedAsinPattern.test(
        String(anchor.getAttribute("href") || anchor.href || "")
      );
    }

    function anchorContainsAnyAsin(anchor) {
      if (!anchor) {
        return false;
      }

      return /(?:\/dp\/|\/gp\/product\/|\/search\/)[A-Z0-9]{10}/i.test(
        String(anchor.getAttribute("href") || anchor.href || "")
      );
    }

    function matchesRequestedAsin(itemInfo) {
      if (!requestedAsin) {
        return true;
      }

      const ownAnchors = Array.from(itemInfo.querySelectorAll("a[href]"));
      if (ownAnchors.some(anchorMatchesRequestedAsin)) {
        return true;
      }
      if (ownAnchors.some(anchorContainsAnyAsin)) {
        return false;
      }

      const reviewWrap = itemInfo.closest(".item-review-wrap");
      if (!reviewWrap) {
        return false;
      }

      return Array.from(reviewWrap.querySelectorAll("a[href]")).some(anchorMatchesRequestedAsin);
    }

    function hasPendingRequestedLegacyCard() {
      if (!requestedAsinPattern) {
        return false;
      }

      return Array.from(root.querySelectorAll(".item-review-wrap")).some((reviewWrap) => {
        const anchors = Array.from(reviewWrap.querySelectorAll("a[href]"));
        if (!anchors.some(anchorMatchesRequestedAsin)) {
          return false;
        }

        return Boolean(reviewWrap.querySelector(".loader, .loading")) ||
          !reviewWrap.querySelector(".item-info");
      });
    }

    function getLegacyCandidateData(itemInfo) {
      const reviewCountText = normalizeText(
        (itemInfo.querySelector(".item-num .boldtxt") || {}).textContent || ""
      );
      const reviewCount = Number(reviewCountText.replace(/[^\d]/g, "")) || 0;
      const ratingNodes = itemInfo.querySelectorAll("p.item-rating");
      const images = getRatingImages(ratingNodes);
      if (!images.length) {
        return null;
      }

      const verdictRoot = itemInfo.querySelector(".item-review-level");
      const verdictImage = getImagePayload(
        verdictRoot && verdictRoot.querySelector(".item-rv-lv img, .item-rv-lv-image img, img")
      );
      const verdictLines = getVerdictLines(
        verdictRoot && verdictRoot.querySelector(".item-rv-score")
      );

      let score = images.length * 10;
      if (verdictRoot) {
        score += 100;
      }
      if (itemInfo.querySelector(".item-rv-score")) {
        score += 50;
      }
      if (itemInfo.querySelector(".button-mini, .button.button-mini, .item-review-level a")) {
        score += 25;
      }
      if (verdictImage) {
        score += 15;
      }
      if (normalizeText(itemInfo.textContent).includes("/5")) {
        score += 5;
      }

      return {
        score,
        reviewCount,
        scorePayload: {
          kind: "visual-image",
          images,
          suffix: "/5",
        },
        verdict:
          verdictImage && verdictLines.length
            ? {
                kind: "visual-verdict",
                image: verdictImage,
                lines: verdictLines,
              }
            : null,
      };
    }

    function extractLegacyScore() {
      const seen = new Set();
      const candidates = Array.from(
        root.querySelectorAll(".item-review-wrap .item-info, .item-info")
      ).filter((itemInfo) => {
        if (seen.has(itemInfo)) {
          return false;
        }
        seen.add(itemInfo);
        return true;
      });

      const matchingCandidates = candidates.filter(matchesRequestedAsin);
      const scopedCandidates = requestedAsin ? matchingCandidates : candidates;

      const bestCandidate = scopedCandidates
        .map(getLegacyCandidateData)
        .filter(Boolean)
        .reduce((best, candidate) => {
          if (!best) {
            return candidate;
          }

          if (candidate.score !== best.score) {
            return candidate.score > best.score ? candidate : best;
          }

          return candidate.reviewCount > best.reviewCount ? candidate : best;
        }, null);

      if (!bestCandidate) {
        if (requestedAsin && candidates.length && !matchingCandidates.length && hasPendingRequestedLegacyCard()) {
          return {
            ok: false,
            code: "not_ready",
            message: "Rendered Sakura Checker product card is not available yet.",
            retryable: true,
          };
        }

        return null;
      }

      return {
        ok: true,
        score: bestCandidate.scorePayload,
        verdict: bestCandidate.verdict,
      };
    }

    function extractModernScore() {
      const alertRoot = root.querySelector(".sakura-alert");
      const scoreRoot = alertRoot && alertRoot.querySelector(".sakura-num");
      if (!scoreRoot) {
        return null;
      }

      const percentRoot = scoreRoot.querySelector(".sakura-num-per");
      const images = Array.from(scoreRoot.querySelectorAll("img"))
        .filter((image) => !percentRoot || !percentRoot.contains(image))
        .map(getImagePayload)
        .filter(Boolean);

      if (!images.length) {
        return null;
      }

      const verdictImage = getImagePayload(root.querySelector(".sakura-rating img"));
      const verdictLine = normalizeText(
        (root.querySelector(".sakura-msg") || {}).textContent || ""
      );

      return {
        ok: true,
        score: {
          kind: "visual-image",
          images,
          suffix: "%",
        },
        verdict:
          verdictImage && verdictLine
            ? {
                kind: "visual-verdict",
                image: verdictImage,
                lines: [verdictLine],
              }
            : null,
      };
    }

    function currentPathname() {
      try {
        if (root.location && root.location.pathname) {
          return root.location.pathname;
        }
      } catch {
        // Ignore DOM location access issues and fall back.
      }

      if (typeof location !== "undefined" && location.pathname) {
        return location.pathname;
      }

      return "";
    }

    function currentTitle() {
      try {
        if (typeof root.title === "string" && root.title) {
          return root.title;
        }
      } catch {
        // Ignore title access issues and fall back.
      }

      if (typeof document !== "undefined" && typeof document.title === "string") {
        return document.title;
      }

      return "";
    }

    function detectBlockedPage() {
      const pathname = currentPathname();
      if (/\/error\/(?:accessdenied|forbidden|blocked|captcha)\//i.test(pathname)) {
        return {
          ok: false,
          code: "blocked",
          message: "Sakura Checker temporarily blocked the request.",
          retryable: false,
        };
      }

      const title = normalizeText(currentTitle()).toLowerCase();
      const bodyText = normalizeText((root.body && root.body.textContent) || root.textContent || "");
      const bodyTextLower = bodyText.toLowerCase();
      const blockedPatterns = [
        /too many requests/i,
        /access denied/i,
        /forbidden/i,
        /captcha/i,
        /recaptcha/i,
        /アクセスが集中/i,
        /アクセス制限/i,
        /しばらく待/i,
        /botではないこと/i,
      ];

      if (blockedPatterns.some((pattern) => pattern.test(title) || pattern.test(bodyTextLower) || pattern.test(bodyText))) {
        return {
          ok: false,
          code: "blocked",
          message: "Sakura Checker temporarily blocked the request.",
          retryable: false,
        };
      }

      return null;
    }

    const blocked = detectBlockedPage();
    if (blocked) {
      return blocked;
    }

    if (/\/error\/notfound\//.test(currentPathname())) {
      return {
        ok: false,
        code: "not_found",
        message: "The product was not found on Sakura Checker.",
        retryable: false,
      };
    }

    const legacy = extractLegacyScore();
    if (legacy && legacy.ok) {
      return legacy;
    }
    if (legacy && legacy.code === "not_ready") {
      return legacy;
    }

    const modern = extractModernScore();
    if (modern) {
      return modern;
    }

    const hasLoadingSignals = Boolean(
      root.querySelector(".loader, .loading, .item-review-wrap, .sakuraBlock, #pagetop")
    );

    return {
      ok: false,
      code: hasLoadingSignals ? "not_ready" : "parse_error",
      message: hasLoadingSignals
        ? "Rendered Sakura Checker score is not available yet."
        : "Could not locate a rendered Sakura Checker score.",
      retryable: hasLoadingSignals,
    };
  }

  return {
    extractRenderedScore,
  };
});
