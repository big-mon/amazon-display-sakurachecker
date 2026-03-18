(function (root, factory) {
  const exportsObject = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }
  root.ScoreParser = exportsObject;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const REVIEW_WRAP_MARKER = '<div class="item-review-wrap">';
  const ITEM_BUTTON_MARKER = '<p class="item-btn">';
  const ITEM_RATING_MARKER = '<p class="item-rating">';
  const ITEM_REVIEW_LEVEL_MARKER = '<div class="item-review-level">';
  const ITEM_REVIEW_SCORE_MARKER = '<p class="item-rv-score">';
  const ITEM_INFO_MARKER = '<div class="item-info';

  function getReviewWrapRanges(html) {
    const starts = [];
    let startIndex = -1;

    while ((startIndex = html.indexOf(REVIEW_WRAP_MARKER, startIndex + 1)) !== -1) {
      starts.push(startIndex);
    }

    return starts.map((start, index) => {
      const nextStart = starts[index + 1] ?? html.length;
      const buttonIndex = html.indexOf(ITEM_BUTTON_MARKER, start);
      const end =
        buttonIndex !== -1 && buttonIndex < nextStart ? buttonIndex : nextStart;
      return { start, end };
    });
  }

  function findPrimaryProductBlock(html, asin) {
    const markers = [
      `https://www.amazon.co.jp/dp/${asin}`,
      `https://www.amazon.co.jp/gp/product/${asin}`,
      `/dp/${asin}`,
      `/gp/product/${asin}`,
    ];

    for (const range of getReviewWrapRanges(html)) {
      const block = html.slice(range.start, range.end);
      if (markers.some((marker) => block.includes(marker))) {
        return block;
      }
    }

    return null;
  }

  function findRatingMarkup(block) {
    const start = block.indexOf(ITEM_RATING_MARKER);
    if (start === -1) {
      return null;
    }

    const end = block.indexOf("</p>", start);
    if (end === -1) {
      return null;
    }

    return block.slice(start, end + 4);
  }

  function findTagEnd(markup, start) {
    let inQuote = null;

    for (let index = start; index < markup.length; index += 1) {
      const character = markup[index];
      if ((character === '"' || character === "'") && inQuote === null) {
        inQuote = character;
        continue;
      }
      if (character === inQuote) {
        inQuote = null;
        continue;
      }
      if (character === ">" && inQuote === null) {
        return index;
      }
    }

    return -1;
  }

  function findClosingDivIndex(markup, start) {
    let depth = 0;
    let searchIndex = start;

    while (searchIndex < markup.length) {
      const nextOpen = markup.indexOf("<div", searchIndex);
      const nextClose = markup.indexOf("</div", searchIndex);

      if (nextOpen === -1 && nextClose === -1) {
        break;
      }

      if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
        const openEnd = findTagEnd(markup, nextOpen);
        if (openEnd === -1) {
          return -1;
        }

        depth += 1;
        searchIndex = openEnd + 1;
        continue;
      }

      const closeEnd = findTagEnd(markup, nextClose);
      if (closeEnd === -1) {
        return -1;
      }

      depth -= 1;
      searchIndex = closeEnd + 1;
      if (depth === 0) {
        return closeEnd + 1;
      }
    }

    return -1;
  }

  function extractItemInfoBlocks(block) {
    const blocks = [];
    let searchIndex = 0;

    while (searchIndex < block.length) {
      const start = block.indexOf(ITEM_INFO_MARKER, searchIndex);
      if (start === -1) {
        break;
      }

      const end = findClosingDivIndex(block, start);
      if (end === -1) {
        break;
      }

      blocks.push(block.slice(start, end));
      searchIndex = end;
    }

    return blocks;
  }

  function scoreItemInfoBlock(block) {
    const images = decodeScoreImagesFromMarkups(extractRatingMarkups(block));
    let score = images.length;

    if (block.includes(ITEM_REVIEW_LEVEL_MARKER)) {
      score += 100;
    }
    if (block.includes("button-mini")) {
      score += 50;
    }
    if (block.includes(ITEM_REVIEW_SCORE_MARKER)) {
      score += 20;
    }
    if (block.includes('<p class="item-num">')) {
      score += 10;
    }

    return score;
  }

  function findPrimaryItemInfoBlock(block) {
    const itemInfoBlocks = extractItemInfoBlocks(block);
    if (!itemInfoBlocks.length) {
      return block;
    }

    return itemInfoBlocks.reduce((bestBlock, currentBlock) => {
      if (!bestBlock) {
        return currentBlock;
      }

      return scoreItemInfoBlock(currentBlock) > scoreItemInfoBlock(bestBlock)
        ? currentBlock
        : bestBlock;
    }, null);
  }

  function decodeScoreImagesFromMarkups(ratingMarkups) {
    const decodedGroups = ratingMarkups
      .map((ratingMarkup) => decodeRatingImages(ratingMarkup))
      .filter((images) => images.length);

    if (!decodedGroups.length) {
      return [];
    }

    const richestGroup = decodedGroups.reduce((best, current) =>
      current.length > best.length ? current : best
    );

    if (richestGroup.length > 1) {
      return richestGroup;
    }

    if (decodedGroups.length > 1) {
      return decodedGroups.flat();
    }

    return richestGroup;
  }

  function decodeScoreImagesFromBlock(block) {
    if (!block) {
      return [];
    }

    const reviewLevelMarkerIndex = block.indexOf(ITEM_REVIEW_LEVEL_MARKER);
    if (reviewLevelMarkerIndex !== -1) {
      const ratingMarkup = findRatingMarkupBeforeMarker(block, ITEM_REVIEW_LEVEL_MARKER);
      if (!ratingMarkup) {
        return [];
      }

      return decodeRatingImages(ratingMarkup);
    }

    return decodeScoreImagesFromMarkups(extractRatingMarkups(block));
  }

  function findReviewLevelMarkup(block) {
    const start = block.indexOf(ITEM_REVIEW_LEVEL_MARKER);
    if (start === -1) {
      return null;
    }

    const end = block.indexOf("</div>", start);
    if (end === -1) {
      return null;
    }

    return block.slice(start, end + 6);
  }

  function extractRatingMarkups(markup) {
    return Array.from(
      markup.matchAll(/<p class="item-rating">[\s\S]*?<\/p>/g),
      (match) => match[0]
    );
  }

  function extractImageTags(markup) {
    const tags = [];
    let searchIndex = 0;

    while (searchIndex < markup.length) {
      const start = markup.indexOf("<img", searchIndex);
      if (start === -1) {
        break;
      }

      let inQuote = null;
      let end = start;

      for (; end < markup.length; end += 1) {
        const character = markup[end];
        if ((character === '"' || character === "'") && inQuote === null) {
          inQuote = character;
          continue;
        }
        if (character === inQuote) {
          inQuote = null;
          continue;
        }
        if (character === ">" && inQuote === null) {
          break;
        }
      }

      if (end >= markup.length) {
        break;
      }

      tags.push(markup.slice(start, end + 1));
      searchIndex = end + 1;
    }

    return tags;
  }

  function parseAttributes(tag) {
    const attributes = {};
    const attributePattern =
      /([^\s=<>\/]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match = null;

    while ((match = attributePattern.exec(tag)) !== null) {
      attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
    }

    return attributes;
  }

  function decodeBase64ToText(base64Text) {
    if (typeof atob === "function") {
      return atob(base64Text);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64Text, "base64").toString("utf8");
    }

    throw new Error("No base64 decoder is available.");
  }

  function restoreObfuscatedValue(scrambled, insertLength, prefixLength) {
    let n = insertLength;
    const totalLength = scrambled.length;
    const originalLength = totalLength - n;
    let prefixStart = originalLength - prefixLength;

    if (prefixStart < 0) {
      prefixStart = 0;
    }
    if (prefixStart > originalLength) {
      prefixStart = originalLength;
    }
    if (n > totalLength) {
      n = totalLength;
    }

    let inserted = "";
    let before = "";
    let after = "";

    if (originalLength >= 0 && prefixStart <= originalLength) {
      inserted = scrambled.substr(prefixStart, n);
      before = scrambled.substr(0, prefixStart);
      after = scrambled.substr(prefixStart + n);
    } else if (originalLength < 0 && totalLength > 0) {
      inserted = scrambled.substr(0, n);
    }

    return inserted + before + after;
  }

  function decodeObfuscatedImageTag(tag) {
    const attributes = parseAttributes(tag);
    const onload = attributes.onload;

    if (!onload) {
      if (attributes.src && attributes.src.startsWith("data:image/")) {
        return { src: attributes.src, alt: attributes.alt || "" };
      }
      return null;
    }

    const scrambledAttributeMatch = onload.match(
      /var _[A-Za-z0-9]+=\s*this(?:\[[^\]]+\])+\('([^']+)'\)/
    );
    if (!scrambledAttributeMatch) {
      return null;
    }

    const scrambledAttributeName = scrambledAttributeMatch[1];
    const numericAssignments = Array.from(
      onload
        .slice(scrambledAttributeMatch.index)
        .matchAll(/var _[A-Za-z0-9]+=(\d+);/g),
      (match) => Number(match[1])
    );

    if (numericAssignments.length < 2) {
      return null;
    }

    const scrambledValue = attributes[scrambledAttributeName];
    if (!scrambledValue) {
      return null;
    }

    const restoredBase64 = restoreObfuscatedValue(
      scrambledValue,
      numericAssignments[0],
      numericAssignments[1]
    );
    const decodedSource = decodeBase64ToText(restoredBase64);

    if (!decodedSource.startsWith("data:image/")) {
      return null;
    }

    return {
      src: decodedSource,
      alt: attributes.alt || "",
    };
  }

  function decodeUrlEncodedBase64Payload(encodedPayload) {
    try {
      return decodeURIComponent(decodeBase64ToText(encodedPayload));
    } catch {
      return null;
    }
  }

  function extractInlineScriptBodies(html) {
    return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1]);
  }

  function extractDecodedScriptBodies(scriptBody) {
    const decodedBodies = [];
    const matches = scriptBody.matchAll(/window\[[^\]]+\]\('([^']+)'\)/g);

    for (const match of matches) {
      try {
        decodedBodies.push(decodeBase64ToText(match[1]));
      } catch {
        continue;
      }
    }

    return decodedBodies;
  }

  function extractScriptStringAssignments(scriptBody) {
    const assignments = new Map();

    for (const match of scriptBody.matchAll(/var\s+([A-Za-z0-9_$]+)\s*=\s*'([^']*)';/g)) {
      assignments.set(match[1], match[2]);
    }

    return assignments;
  }

  function extractInjectedHtmlSnippetsFromScript(scriptBody) {
    const assignments = extractScriptStringAssignments(scriptBody);
    const snippets = new Set();

    for (const match of scriptBody.matchAll(
      /(?:before|html)\(decodeURIComponent\(atob\(([A-Za-z0-9_$]+)\)\)\)/g
    )) {
      const encodedPayload = assignments.get(match[1]);
      if (!encodedPayload) {
        continue;
      }

      const decodedSnippet = decodeUrlEncodedBase64Payload(encodedPayload);
      if (decodedSnippet) {
        snippets.add(decodedSnippet);
      }
    }

    for (const encodedPayload of assignments.values()) {
      const decodedSnippet = decodeUrlEncodedBase64Payload(encodedPayload);
      if (
        decodedSnippet &&
        decodedSnippet.includes("<") &&
        decodedSnippet.includes(">") &&
        (
          decodedSnippet.includes(ITEM_RATING_MARKER) ||
          decodedSnippet.includes(ITEM_REVIEW_LEVEL_MARKER) ||
          decodedSnippet.includes("sakura-alert")
        )
      ) {
        snippets.add(decodedSnippet);
      }
    }

    return Array.from(snippets);
  }

  function extractInjectedHtmlSnippets(html) {
    const snippets = [];

    for (const scriptBody of extractInlineScriptBodies(html)) {
      snippets.push(...extractInjectedHtmlSnippetsFromScript(scriptBody));

      for (const decodedScriptBody of extractDecodedScriptBodies(scriptBody)) {
        snippets.push(...extractInjectedHtmlSnippetsFromScript(decodedScriptBody));
      }
    }

    return snippets;
  }

  function findPrimaryInjectedSnippet(html) {
    const snippets = extractInjectedHtmlSnippets(html).filter((snippet) =>
      snippet.includes(ITEM_RATING_MARKER)
    );

    return (
      snippets.find(
        (snippet) =>
          snippet.includes(ITEM_REVIEW_LEVEL_MARKER) && snippet.includes("item-review-after")
      ) || null
    );
  }

  function findPrimarySakuraAlertSnippet(html) {
    const snippets = extractInjectedHtmlSnippets(html).filter((snippet) =>
      snippet.includes('class="sakura-alert"')
    );

    return snippets[0] || null;
  }

  function findPrimarySakuraRatingSnippet(html) {
    const snippets = extractInjectedHtmlSnippets(html).filter((snippet) =>
      snippet.includes("sakura-rating")
    );

    return snippets[0] || null;
  }

  function findRatingMarkupBeforeMarker(markup, marker) {
    const markerIndex = markup.indexOf(marker);
    const searchableMarkup = markerIndex === -1 ? markup : markup.slice(0, markerIndex);
    const ratings = extractRatingMarkups(searchableMarkup);

    return ratings.length ? ratings[ratings.length - 1] : null;
  }

  function decodeRatingImages(ratingMarkup) {
    return extractImageTags(ratingMarkup).map(decodeObfuscatedImageTag).filter(Boolean);
  }

  function decodeSakuraAlertScore(alertMarkup) {
    if (!alertMarkup) {
      return [];
    }

    const start = alertMarkup.indexOf('<span class="sakura-num">');
    if (start === -1) {
      return [];
    }

    const percentMarkerIndex = alertMarkup.indexOf('<span class="sakura-num-per">', start);
    const searchableMarkup =
      percentMarkerIndex === -1 ? alertMarkup.slice(start) : alertMarkup.slice(start, percentMarkerIndex);

    return extractImageTags(searchableMarkup).map(decodeObfuscatedImageTag).filter(Boolean);
  }

  function decodeSakuraAlertMessage(alertMarkup) {
    if (!alertMarkup) {
      return [];
    }

    const match = alertMarkup.match(/<span class="sakura-msg[^"]*">([\s\S]*?)<\/span>/);
    if (!match) {
      return [];
    }

    const message = normalizeVerdictLine(match[1]);
    return message ? [message] : [];
  }

  function decodeHtmlEntities(text) {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function normalizeVerdictLine(text) {
    return decodeHtmlEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }

  function decodeVerdictImage(levelMarkup) {
    const imageTag = extractImageTags(levelMarkup)[0];
    if (!imageTag) {
      return null;
    }

    const attributes = parseAttributes(imageTag);
    if (!attributes.src) {
      return null;
    }

    return {
      src: attributes.src,
      alt: attributes.alt || "",
    };
  }

  function decodeVerdictLines(levelMarkup) {
    const start = levelMarkup.indexOf(ITEM_REVIEW_SCORE_MARKER);
    if (start === -1) {
      return [];
    }

    const end = levelMarkup.indexOf("</p>", start);
    if (end === -1) {
      return [];
    }

    const scoreMarkup = levelMarkup.slice(
      start + ITEM_REVIEW_SCORE_MARKER.length,
      end
    );
    return scoreMarkup
      .split(/<br\s*\/?>/i)
      .map(normalizeVerdictLine)
      .filter(Boolean);
  }

  function decodeVerdict(levelMarkup) {
    const image = decodeVerdictImage(levelMarkup);
    const lines = decodeVerdictLines(levelMarkup);

    if (!image || !lines.length) {
      return null;
    }

    return {
      kind: "visual-verdict",
      image,
      lines,
    };
  }

  function parseModernInjectedScore(html) {
    const alertSnippet = findPrimarySakuraAlertSnippet(html);
    if (!alertSnippet) {
      return null;
    }

    const images = decodeSakuraAlertScore(alertSnippet);
    if (!images.length) {
      return null;
    }

    const ratingSnippet = findPrimarySakuraRatingSnippet(html);
    const ratingImage = ratingSnippet ? decodeVerdictImage(ratingSnippet) : null;
    const verdictLines = decodeSakuraAlertMessage(alertSnippet);

    return {
      ok: true,
      score: {
        kind: "visual-image",
        images,
        suffix: "%",
      },
      verdict: ratingImage
        ? {
            kind: "visual-verdict",
            image: ratingImage,
            lines: verdictLines,
          }
        : null,
    };
  }

  function parseVisualScore(html, asin) {
    let scoreImages = [];
    let reviewLevelMarkup = null;

    const injectedSnippet = findPrimaryInjectedSnippet(html);
    if (injectedSnippet) {
      scoreImages = decodeScoreImagesFromBlock(injectedSnippet);
      reviewLevelMarkup = findReviewLevelMarkup(injectedSnippet);
    }

    if (!scoreImages.length) {
      const productBlock = findPrimaryProductBlock(html, asin);
      if (!productBlock) {
        const modernScore = parseModernInjectedScore(html);
        if (modernScore) {
          return modernScore;
        }

        return {
          ok: false,
          code: "not_found",
          message: `Could not find a Sakura Checker block for ASIN ${asin}.`,
        };
      }

      const primaryItemInfoBlock = findPrimaryItemInfoBlock(productBlock);
      scoreImages = decodeScoreImagesFromBlock(primaryItemInfoBlock);
      reviewLevelMarkup = findReviewLevelMarkup(primaryItemInfoBlock);
      if (!scoreImages.length) {
        const modernScore = parseModernInjectedScore(html);
        if (modernScore) {
          return modernScore;
        }

        return {
          ok: false,
          code: "parse_error",
          message: "Could not locate the item-rating markup.",
        };
      }
    }

    const verdict = reviewLevelMarkup ? decodeVerdict(reviewLevelMarkup) : null;

    return {
      ok: true,
      score: {
        kind: "visual-image",
        images: scoreImages,
        suffix: "/5",
      },
      verdict,
    };
  }

  return {
    decodeVerdict,
    decodeVerdictImage,
    decodeVerdictLines,
    decodeRatingImages,
    decodeObfuscatedImageTag,
    decodeSakuraAlertMessage,
    decodeSakuraAlertScore,
    decodeUrlEncodedBase64Payload,
    decodeScoreImagesFromBlock,
    decodeScoreImagesFromMarkups,
    extractDecodedScriptBodies,
    extractInjectedHtmlSnippets,
    extractImageTags,
    extractInlineScriptBodies,
    extractRatingMarkups,
    extractScriptStringAssignments,
    findPrimaryProductBlock,
    findPrimaryInjectedSnippet,
    findPrimaryItemInfoBlock,
    findPrimarySakuraAlertSnippet,
    findPrimarySakuraRatingSnippet,
    findRatingMarkup,
    findRatingMarkupBeforeMarker,
    findReviewLevelMarkup,
    parseAttributes,
    parseModernInjectedScore,
    parseVisualScore,
    restoreObfuscatedValue,
  };
});
