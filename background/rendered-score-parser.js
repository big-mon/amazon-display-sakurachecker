(function (root, factory) {
  const exportsObject = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.RenderedScoreParser = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function () {
  function createFailure(code, message, retryable) {
    return {
      ok: false,
      code,
      message,
      retryable,
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createTextVerdict(lines) {
    const normalizedLines = Array.isArray(lines)
      ? lines.map(normalizeText).filter(Boolean)
      : [];
    if (!normalizedLines.length) {
      return null;
    }

    return {
      kind: "text-verdict",
      lines: normalizedLines,
    };
  }

  function buildRequestedAsinPattern(requestedAsin) {
    if (!requestedAsin) {
      return null;
    }

    return new RegExp(
      `(?:/dp/|/gp/product/|/search/|\\b)${requestedAsin}(?:[/?#&]|$)`,
      "i"
    );
  }

  function createContext(rootNodeOrAsin, maybeRequestedAsin) {
    const root =
      rootNodeOrAsin && typeof rootNodeOrAsin.querySelector === "function"
        ? rootNodeOrAsin
        : (typeof document !== "undefined" ? document : null);
    const requestedAsin =
      root === rootNodeOrAsin ? maybeRequestedAsin : rootNodeOrAsin;

    if (!root || typeof root.querySelector !== "function") {
      return null;
    }

    return {
      requestedAsin,
      requestedAsinPattern: buildRequestedAsinPattern(requestedAsin),
      root,
    };
  }

  function currentPathname(context) {
    try {
      if (context.root.location && context.root.location.pathname) {
        return context.root.location.pathname;
      }
    } catch {
      // Ignore DOM location access issues and fall back.
    }

    if (typeof location !== "undefined" && location.pathname) {
      return location.pathname;
    }

    try {
      if (context.root.baseURI) {
        return new URL(context.root.baseURI).pathname;
      }
    } catch {
      // Ignore baseURI parsing issues and fall back.
    }

    return "";
  }

  function currentTitle(context) {
    try {
      if (typeof context.root.title === "string" && context.root.title) {
        return context.root.title;
      }
    } catch {
      // Ignore title access issues and fall back.
    }

    if (typeof document !== "undefined" && typeof document.title === "string") {
      return document.title;
    }

    return "";
  }

  function resolveUrl(context, value) {
    if (!value) {
      return value;
    }

    if (/^(?:data:|https?:|chrome-extension:)/i.test(value)) {
      return value;
    }

    const baseUrl =
      context.root.baseURI ||
      ((context.root.location && context.root.location.href) || null) ||
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

  function getImagePayload(context, image) {
    if (!image) {
      return null;
    }

    const src = resolveUrl(context, image.src || image.getAttribute("src") || "");
    if (!src) {
      return null;
    }

    return {
      src,
      alt: image.getAttribute("alt") || image.alt || "",
    };
  }

  function getRatingImages(context, ratingNodes) {
    const imageGroups = Array.from(ratingNodes, (ratingNode) =>
      Array.from(ratingNode.querySelectorAll("img"))
        .map((image) => getImagePayload(context, image))
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

  function anchorMatchesRequestedAsin(context, anchor) {
    if (!context.requestedAsinPattern || !anchor) {
      return false;
    }

    return context.requestedAsinPattern.test(
      String(anchor.getAttribute("href") || anchor.href || "")
    );
  }

  function getDirectChildItemInfos(reviewWrap) {
    if (!reviewWrap || !reviewWrap.children) {
      return [];
    }

    return Array.from(reviewWrap.children).filter(
      (child) =>
        child &&
        typeof child.matches === "function" &&
        child.matches(".item-info")
    );
  }

  function reviewWrapMatchesRequestedAsin(context, reviewWrap) {
    if (!context.requestedAsinPattern || !reviewWrap) {
      return false;
    }

    return Array.from(reviewWrap.querySelectorAll("a[href]")).some((anchor) =>
      anchorMatchesRequestedAsin(context, anchor)
    );
  }

  function hasExactRequestedAsinMatch(context, itemInfo) {
    if (!context.requestedAsin) {
      return false;
    }

    const ownAnchors = Array.from(itemInfo.querySelectorAll("a[href]"));
    if (ownAnchors.some((anchor) => anchorMatchesRequestedAsin(context, anchor))) {
      return true;
    }

    return String(itemInfo.outerHTML || "").includes(context.requestedAsin);
  }

  function hasPendingRequestedLegacyCard(context) {
    if (!context.requestedAsinPattern) {
      return false;
    }

    return Array.from(context.root.querySelectorAll(".item-review-wrap")).some((reviewWrap) => {
      const anchors = Array.from(reviewWrap.querySelectorAll("a[href]"));
      if (!anchors.some((anchor) => anchorMatchesRequestedAsin(context, anchor))) {
        return false;
      }

      return Boolean(reviewWrap.querySelector(".loader, .loading")) ||
        !reviewWrap.querySelector(".item-info");
    });
  }

  function getLegacyCandidateData(context, itemInfo) {
    const reviewCountText = normalizeText(
      (itemInfo.querySelector(".item-num .boldtxt") || {}).textContent || ""
    );
    const reviewCount = Number(reviewCountText.replace(/[^\d]/g, "")) || 0;
    const ratingNodes = itemInfo.querySelectorAll("p.item-rating");
    const images = getRatingImages(context, ratingNodes);
    if (!images.length) {
      return null;
    }

    const verdictRoot = itemInfo.querySelector(".item-review-level");
    const verdictImage = getImagePayload(
      context,
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
      reviewCount,
      score,
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

  function findUnavailableLegacyCandidate(context, itemInfos) {
    const candidates = Array.isArray(itemInfos) ? itemInfos : [];

    return candidates.find((itemInfo) => {
      if (!itemInfo) {
        return false;
      }

      const reviewWrap =
        typeof itemInfo.closest === "function" ? itemInfo.closest(".item-review-wrap") : null;
      if (
        itemInfo.querySelector(".loader, .loading") ||
        (reviewWrap && reviewWrap.querySelector(".loader, .loading"))
      ) {
        return false;
      }

      const verdictLines = getVerdictLines(
        itemInfo.querySelector(".item-review-level .item-rv-score, .item-rv-score")
      );
      if (!verdictLines.length) {
        return false;
      }

      const ratingNodes = itemInfo.querySelectorAll("p.item-rating");
      const ratingImages = getRatingImages(context, ratingNodes);
      if (ratingImages.length) {
        return false;
      }

      const ratingText = normalizeText(
        Array.from(ratingNodes, (ratingNode) => ratingNode.textContent || "").join(" ")
      );

      return !ratingText.includes("/5");
    });
  }

  function collectLegacyCandidates(context, allowAmbiguousMatches) {
    const seen = new Set();
    const candidates = Array.from(
      context.root.querySelectorAll(".item-review-wrap .item-info, .item-info")
    ).filter((itemInfo) => {
      if (seen.has(itemInfo)) {
        return false;
      }
      seen.add(itemInfo);
      return true;
    });

    let matchingCandidates = candidates;
    let scopedCandidates = candidates;

    if (context.requestedAsin) {
      const matchingWraps = Array.from(context.root.querySelectorAll(".item-review-wrap")).filter(
        (reviewWrap) => reviewWrapMatchesRequestedAsin(context, reviewWrap)
      );

      const exactCandidates = matchingWraps.flatMap((reviewWrap) =>
        getDirectChildItemInfos(reviewWrap).filter((itemInfo) =>
          hasExactRequestedAsinMatch(context, itemInfo)
        )
      );

      if (exactCandidates.length) {
        matchingCandidates = exactCandidates;
        scopedCandidates = exactCandidates;
      } else {
        const ambiguousWrapCandidates = matchingWraps.flatMap((reviewWrap) =>
          getDirectChildItemInfos(reviewWrap)
        );
        const singleCardWrapCandidates = matchingWraps
          .map((reviewWrap) => getDirectChildItemInfos(reviewWrap))
          .filter((itemInfos) => itemInfos.length === 1)
          .map((itemInfos) => itemInfos[0]);

        if (singleCardWrapCandidates.length) {
          matchingCandidates = singleCardWrapCandidates;
          scopedCandidates = singleCardWrapCandidates;
        } else if (allowAmbiguousMatches && ambiguousWrapCandidates.length) {
          matchingCandidates = ambiguousWrapCandidates;
          scopedCandidates = ambiguousWrapCandidates;
        } else {
          matchingCandidates = [];
          scopedCandidates = [];
        }
      }
    }

    return {
      candidates,
      matchingCandidates,
      scopedCandidates,
    };
  }

  function pickBestLegacyCandidate(candidateDataList) {
    return candidateDataList.reduce((best, candidate) => {
      if (!best) {
        return candidate;
      }

      if (candidate.score !== best.score) {
        return candidate.score > best.score ? candidate : best;
      }

      return candidate.reviewCount > best.reviewCount ? candidate : best;
    }, null);
  }

  function extractLegacyScore(context, options = {}) {
    const allowAmbiguousMatches = Boolean(options.allowAmbiguousMatches);
    const { candidates, matchingCandidates, scopedCandidates } = collectLegacyCandidates(
      context,
      allowAmbiguousMatches
    );
    const bestCandidate = pickBestLegacyCandidate(
      scopedCandidates
        .map((itemInfo) => getLegacyCandidateData(context, itemInfo))
        .filter(Boolean)
    );

    if (!bestCandidate) {
      if (
        findUnavailableLegacyCandidate(
          context,
          scopedCandidates.length ? scopedCandidates : matchingCandidates
        )
      ) {
        return createFailure(
          "not_available",
          "Sakura Checker has not published a score for this product yet.",
          false
        );
      }

      if (
        context.requestedAsin &&
        candidates.length &&
        !matchingCandidates.length &&
        hasPendingRequestedLegacyCard(context)
      ) {
        return createFailure(
          "not_ready",
          "Rendered Sakura Checker product card is not available yet.",
          true
        );
      }

      return null;
    }

    return {
      ok: true,
      score: bestCandidate.scorePayload,
      verdict: bestCandidate.verdict,
    };
  }

  function extractItemSearchScore(context) {
    const candidates = Array.from(context.root.querySelectorAll('[name="searchitem"]'));
    if (!candidates.length) {
      return null;
    }

    const matchingCandidate = candidates.find((candidate) => {
      if (!context.requestedAsinPattern) {
        return true;
      }

      return Array.from(candidate.querySelectorAll("a[href]")).some((anchor) =>
        anchorMatchesRequestedAsin(context, anchor)
      );
    });

    if (!matchingCandidate) {
      return null;
    }

    const scoreNode = matchingCandidate.querySelector(".item-info .item-rating, .item-rating");
    const scoreText = normalizeText((scoreNode || {}).textContent || "");
    const scoreMatch = scoreText.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*5/i);
    if (!scoreMatch) {
      return null;
    }

    const sakuraPercentText = normalizeText(
      (
        matchingCandidate.querySelector(".item-info .item-sakura .is-size-7, .item-sakura .is-size-7") ||
        {}
      ).textContent || ""
    );
    const levelText = normalizeText(
      (matchingCandidate.querySelector(".item-info .item-lv, .item-lv") || {}).textContent || ""
    );

    const verdictLines = [];
    if (levelText) {
      verdictLines.push(levelText);
    }
    if (sakuraPercentText) {
      verdictLines.push(`サクラ度 ${sakuraPercentText}`);
    }

    return {
      ok: true,
      score: {
        kind: "text",
        value: scoreMatch[1],
        suffix: "/5",
      },
      verdict: createTextVerdict(verdictLines),
    };
  }

  function extractModernScore(context) {
    const alertRoot = context.root.querySelector(".sakura-alert");
    const scoreRoot = alertRoot && alertRoot.querySelector(".sakura-num");
    if (!scoreRoot) {
      return null;
    }

    const percentRoot = scoreRoot.querySelector(".sakura-num-per");
    const images = Array.from(scoreRoot.querySelectorAll("img"))
      .filter((image) => !percentRoot || !percentRoot.contains(image))
      .map((image) => getImagePayload(context, image))
      .filter(Boolean);

    if (!images.length) {
      return null;
    }

    const verdictImage = getImagePayload(context, context.root.querySelector(".sakura-rating img"));
    const verdictLine = normalizeText(
      (context.root.querySelector(".sakura-msg") || {}).textContent || ""
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

  function detectBlockedPage(context) {
    const pathname = currentPathname(context);
    if (/\/error\/(?:accessdenied|forbidden|blocked|captcha)\//i.test(pathname)) {
      return createFailure(
        "blocked",
        "Sakura Checker temporarily blocked the request.",
        false
      );
    }

    const title = normalizeText(currentTitle(context)).toLowerCase();
    const bodyText = normalizeText(
      (context.root.body && context.root.body.textContent) || context.root.textContent || ""
    );
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

    if (
      blockedPatterns.some(
        (pattern) =>
          pattern.test(title) || pattern.test(bodyTextLower) || pattern.test(bodyText)
      )
    ) {
      return createFailure(
        "blocked",
        "Sakura Checker temporarily blocked the request.",
        false
      );
    }

    return null;
  }

  function detectMissingProduct(context) {
    if (/\/error\/notfound\//.test(currentPathname(context))) {
      return createFailure(
        "not_found",
        "The product was not found on Sakura Checker.",
        false
      );
    }

    return null;
  }

  function detectUrlSearchRequired(context) {
    if (!/\/itemsearch\/?/i.test(currentPathname(context))) {
      return null;
    }

    const bodyText = normalizeText(
      (context.root.body && context.root.body.textContent) || context.root.textContent || ""
    );

    if (
      bodyText.includes("商品名検索では商品が見つかりませんでした。") &&
      bodyText.includes("アマゾン製品URLでのURL検索をお試し下さい。") &&
      bodyText.includes("URLでは必ず検出できます。")
    ) {
      return createFailure(
        "url_search_required",
        "Sakura Checker asked for an Amazon product URL search.",
        false
      );
    }

    return null;
  }

  function buildFallbackResult(context) {
    const hasLoadingSignals = Boolean(
      context.root.querySelector(".loader, .loading, .item-review-wrap, .sakuraBlock, #pagetop")
    );

    return createFailure(
      hasLoadingSignals ? "not_ready" : "parse_error",
      hasLoadingSignals
        ? "Rendered Sakura Checker score is not available yet."
        : "Could not locate a rendered Sakura Checker score.",
      hasLoadingSignals
    );
  }

  function extractRenderedScore(rootNodeOrAsin, maybeRequestedAsin) {
    const context = createContext(rootNodeOrAsin, maybeRequestedAsin);
    if (!context) {
      return createFailure(
        "parse_error",
        "A DOM root is required to extract the rendered Sakura Checker score.",
        false
      );
    }

    const blocked = detectBlockedPage(context);
    if (blocked) {
      return blocked;
    }

    const missingProduct = detectMissingProduct(context);
    if (missingProduct) {
      return missingProduct;
    }

    const itemSearch = extractItemSearchScore(context);
    if (itemSearch) {
      return itemSearch;
    }

    const urlSearchRequired = detectUrlSearchRequired(context);
    if (urlSearchRequired) {
      return urlSearchRequired;
    }

    const legacy = extractLegacyScore(context);
    if (legacy && legacy.ok) {
      return legacy;
    }

    const modern = extractModernScore(context);
    if (modern) {
      return modern;
    }

    const ambiguousLegacy = extractLegacyScore(context, { allowAmbiguousMatches: true });
    if (ambiguousLegacy && ambiguousLegacy.ok) {
      return ambiguousLegacy;
    }

    if (ambiguousLegacy && ambiguousLegacy.ok === false) {
      return ambiguousLegacy;
    }

    if (legacy && legacy.ok === false) {
      return legacy;
    }

    return buildFallbackResult(context);
  }

  return {
    extractRenderedScore,
  };
});
