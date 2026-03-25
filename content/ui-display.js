(function () {
  const ROOT_ID = "sakura-checker-result";
  const STYLE_ID = "sakura-checker-style";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        border: 1px solid #d5d9d9;
        border-left: 4px solid #f08804;
        border-radius: 8px;
        background: #ffffff;
        padding: 12px 16px;
        margin: 12px 0;
        box-shadow: 0 1px 3px rgba(15, 17, 17, 0.08);
        color: #0f1111;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      #${ROOT_ID} .sc-item {
        min-width: 0;
      }

      #${ROOT_ID} .sc-value {
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: 700;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-main {
        flex: 1 1 auto;
      }

      #${ROOT_ID} .sc-side {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-start;
        gap: 6px;
      }

      #${ROOT_ID} .sc-side-top,
      #${ROOT_ID} .sc-side-bottom {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      #${ROOT_ID} .sc-score-value {
        display: flex;
        align-items: center;
        gap: 8px 12px;
        flex-wrap: nowrap;
        min-height: 28px;
      }

      #${ROOT_ID} .sc-score-images {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      #${ROOT_ID} .sc-score-images img {
        max-height: 28px;
        width: auto;
        display: block;
      }

      #${ROOT_ID} .sc-score-text {
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #e5374f;
      }

      #${ROOT_ID} .sc-suffix {
        font-size: 18px;
        font-weight: 700;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-verdict {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 28px;
        margin-left: 1em;
      }

      #${ROOT_ID} .sc-verdict img {
        max-height: 32px;
        width: auto;
        display: block;
      }

      #${ROOT_ID} .sc-verdict-text {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        font-size: 13px;
        font-weight: 700;
        color: #565959;
        white-space: nowrap;
      }

      #${ROOT_ID} .sc-accent {
        color: #e5374f;
      }

      #${ROOT_ID} .sc-status-value {
        color: #007185;
        font-size: 16px;
        line-height: 1;
        white-space: nowrap;
      }

      #${ROOT_ID} .sc-status-indicator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        font-size: 16px;
      }

      #${ROOT_ID} .sc-status-indicator[data-status-tone="fresh"] {
        color: #067d62;
      }

      #${ROOT_ID} .sc-status-indicator[data-status-tone="cached"] {
        color: #f0b400;
      }

      #${ROOT_ID} .sc-status-indicator[data-status-tone="error"] {
        color: #e5374f;
      }

      #${ROOT_ID} .sc-link {
        appearance: none;
        border: 1px solid #d5d9d9;
        border-radius: 999px;
        background: #ffffff;
        color: #0f1111;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        padding: 7px 12px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      #${ROOT_ID} .sc-link.sc-link-button {
        font-family: inherit;
        line-height: 1.2;
      }

      #${ROOT_ID} .sc-link.sc-icon-link {
        font-size: 16px;
        line-height: 1;
        border: 0;
        background: transparent;
        min-width: auto;
        min-height: auto;
        padding: 0;
      }

      #${ROOT_ID} .sc-link.sc-icon-link:hover {
        background: transparent;
        opacity: 0.7;
      }

      #${ROOT_ID} .sc-link:hover {
        background: #f7fafa;
      }

      #${ROOT_ID}[data-state="error"] {
        border-left-color: #b12704;
      }

      #${ROOT_ID}[data-state="loading"] {
        border-left-color: #007185;
      }

      @media (max-width: 720px) {
        #${ROOT_ID} {
          align-items: flex-start;
          flex-direction: column;
        }

        #${ROOT_ID} .sc-side {
          align-items: flex-start;
        }

        #${ROOT_ID} .sc-side-top,
        #${ROOT_ID} .sc-side-bottom {
          justify-content: flex-start;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function findInsertionPoint() {
    return (
      document.querySelector("#title_feature_div") ||
      document.querySelector("#titleSection") ||
      document.querySelector("#centerCol") ||
      document.querySelector("#ppd")
    );
  }

  function ensureRoot() {
    ensureStyles();

    let root = document.getElementById(ROOT_ID);
    if (root && document.contains(root)) {
      return root;
    }

    root = document.createElement("section");
    root.id = ROOT_ID;

    const insertionPoint = findInsertionPoint();
    if (insertionPoint && insertionPoint.parentNode) {
      insertionPoint.insertAdjacentElement("afterend", root);
    } else if (document.body) {
      document.body.insertAdjacentElement("afterbegin", root);
    }

    return root;
  }

  function clearRoot(root) {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
  }

  function appendItem(root, valueNode, itemClassName = "") {
    const item = document.createElement("div");
    item.className = `sc-item${itemClassName ? ` ${itemClassName}` : ""}`;
    item.appendChild(valueNode);
    root.appendChild(item);
  }

  function createTextValue(text, className = "") {
    const value = document.createElement("div");
    value.className = `sc-value${className ? ` ${className}` : ""}`;
    value.textContent = text;
    return value;
  }

  function createStatusIndicator(statusTone, currentLabel) {
    const value = document.createElement("div");
    value.className = "sc-value sc-status-value";

    const indicator = document.createElement("span");
    indicator.className = "sc-status-indicator";
    indicator.dataset.statusTone = statusTone;
    indicator.textContent = getStatusSymbol(statusTone);

    const tooltip =
      `${currentLabel}\n` +
      "緑: 取得成功した最新値\n" +
      "黄: キャッシュから表示した値\n" +
      "赤: 取得に失敗した値";
    indicator.title = tooltip;
    indicator.setAttribute("aria-label", currentLabel);

    value.appendChild(indicator);
    return value;
  }

  function getStatusSymbol(statusTone) {
    if (statusTone === "fresh") {
      return "✓";
    }

    if (statusTone === "error") {
      return "×";
    }

    return "●";
  }

  function createVerdictNode(verdict) {
    if (!verdict || (!verdict.image && (!verdict.lines || !verdict.lines.length))) {
      return null;
    }

    const verdictNode = document.createElement("div");
    verdictNode.className = "sc-verdict";

    if (verdict.image) {
      const icon = document.createElement("img");
      icon.src = verdict.image.src;
      icon.alt = verdict.image.alt || "サクラチェッカーの判定";
      verdictNode.appendChild(icon);
    }

    if (Array.isArray(verdict.lines) && verdict.lines.length) {
      const text = document.createElement("span");
      text.className = "sc-verdict-text";

      verdict.lines.forEach((line) => {
        text.appendChild(createVerdictLineNode(line));
      });

      verdictNode.appendChild(text);
    }

    return verdictNode;
  }

  function createVerdictLineNode(line) {
    const text = document.createElement("span");
    const normalizedLine = String(line || "").trim();
    const sakuraDegreeMatch = normalizedLine.match(/^サクラ度\s*(\d+(?:\.\d+)?%)$/);

    if (!sakuraDegreeMatch) {
      text.textContent = normalizedLine;
      return text;
    }

    const label = document.createElement("span");
    label.textContent = "🌸 ";
    text.appendChild(label);

    const value = document.createElement("span");
    value.className = "sc-accent";
    value.textContent = sakuraDegreeMatch[1];
    text.appendChild(value);

    return text;
  }

  function createScoreValue(score, verdict) {
    const value = document.createElement("div");
    value.className = "sc-value sc-score-value";

    if (!score) {
      value.textContent = "-";
      return value;
    }

    if (score.kind === "text") {
      const scoreText = document.createElement("span");
      scoreText.className = "sc-score-text";
      scoreText.textContent = score.value;
      value.appendChild(scoreText);

      const suffix = document.createElement("span");
      suffix.className = "sc-suffix";
      suffix.textContent = score.suffix;
      value.appendChild(suffix);

      const textVerdict = createVerdictNode(verdict);
      if (textVerdict) {
        value.appendChild(textVerdict);
      }

      return value;
    }

    const scoreImages = document.createElement("div");
    scoreImages.className = "sc-score-images";

    for (const image of score.images) {
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || "サクラチェッカーのスコア";
      scoreImages.appendChild(img);
    }

    const suffix = document.createElement("span");
    suffix.className = "sc-suffix";
    suffix.textContent = score.suffix;
    scoreImages.appendChild(suffix);
    value.appendChild(scoreImages);

    const verdictNode = createVerdictNode(verdict);
    if (verdictNode) {
      value.appendChild(verdictNode);
    }

    return value;
  }

  function createLinkValue(sourceUrl) {
    const value = document.createElement("div");
    value.className = "sc-value";

    if (!sourceUrl) {
      value.textContent = "-";
      return value;
    }

    const openLink = document.createElement("a");
    openLink.className = "sc-link sc-icon-link";
    openLink.href = sourceUrl;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.title = "サクラチェッカーを開く";
    openLink.setAttribute("aria-label", "サクラチェッカーを開く");
    openLink.textContent = "🔗";
    value.appendChild(openLink);

    return value;
  }

  function createRefreshButton(onRefresh) {
    if (typeof onRefresh !== "function") {
      return null;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sc-link sc-link-button";
    button.textContent = "再取得";
    button.addEventListener("click", () => {
      onRefresh();
    });
    return button;
  }

  function renderLayout({ score, verdict, sourceUrl, statusNode = null, actionNode = null }) {
    const root = ensureRoot();
    clearRoot(root);

    const main = document.createElement("div");
    main.className = "sc-main";
    appendItem(main, createScoreValue(score, verdict));

    const side = document.createElement("div");
    side.className = "sc-side";

    const sideTop = document.createElement("div");
    sideTop.className = "sc-side-top";
    if (statusNode) {
      appendItem(sideTop, statusNode);
    }

    const sideBottom = document.createElement("div");
    sideBottom.className = "sc-side-bottom";
    if (actionNode) {
      appendItem(sideBottom, actionNode);
    }
    appendItem(sideBottom, createLinkValue(sourceUrl));

    if (sideTop.children.length) {
      side.appendChild(sideTop);
    }
    if (sideBottom.children.length) {
      side.appendChild(sideBottom);
    }

    root.appendChild(main);
    root.appendChild(side);
  }

  function renderLoading(sourceUrl) {
    const root = ensureRoot();
    root.dataset.state = "loading";
    renderLayout({
      score: null,
      verdict: null,
      sourceUrl,
      statusNode: createTextValue("取得中", "sc-status-value"),
    });
  }

  function renderSuccess(payload, { onRefresh = null } = {}) {
    const root = ensureRoot();
    root.dataset.state = "success";
    renderLayout({
      score: payload.score,
      verdict: payload.verdict || null,
      sourceUrl: payload.sourceUrl,
      statusNode: createStatusIndicator(
        payload.cached ? "cached" : "fresh",
        payload.cached ? "キャッシュから表示中" : "最新値を取得済み"
      ),
      actionNode: payload.cached ? createRefreshButton(onRefresh) : null,
    });
  }

  function renderError(payload) {
    const root = ensureRoot();
    root.dataset.state = "error";
    renderLayout({
      score: null,
      verdict: null,
      sourceUrl: payload && payload.sourceUrl ? payload.sourceUrl : null,
      statusNode: createStatusIndicator("error", "取得失敗"),
    });
  }

  function remove() {
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.remove();
    }
  }

  window.UiDisplay = {
    ensureRoot,
    remove,
    renderError,
    renderLoading,
    renderSuccess,
  };
})();
