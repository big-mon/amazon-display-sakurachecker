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
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      #${ROOT_ID} .sc-item {
        min-width: 0;
      }

      #${ROOT_ID} .sc-label {
        display: block;
        font-size: 12px;
        color: #565959;
        margin-bottom: 4px;
      }

      #${ROOT_ID} .sc-value {
        min-height: 28px;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: 700;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-score-value {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }

      #${ROOT_ID} .sc-score-value img {
        max-height: 28px;
        width: auto;
        display: block;
      }

      #${ROOT_ID} .sc-suffix {
        font-size: 18px;
        font-weight: 700;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-status-value {
        color: #007185;
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

      #${ROOT_ID} .sc-link:hover {
        background: #f7fafa;
      }

      #${ROOT_ID}[data-state="success"] .sc-status-value {
        color: #067d62;
      }

      #${ROOT_ID}[data-state="error"] {
        border-left-color: #b12704;
      }

      #${ROOT_ID}[data-state="error"] .sc-status-value {
        color: #b12704;
      }

      #${ROOT_ID}[data-state="loading"] {
        border-left-color: #007185;
      }

      @media (max-width: 720px) {
        #${ROOT_ID} {
          grid-template-columns: 1fr;
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

  function appendItem(root, labelText, valueNode, itemClassName = "") {
    const item = document.createElement("div");
    item.className = `sc-item${itemClassName ? ` ${itemClassName}` : ""}`;

    const label = document.createElement("span");
    label.className = "sc-label";
    label.textContent = labelText;

    item.appendChild(label);
    item.appendChild(valueNode);
    root.appendChild(item);
  }

  function createTextValue(text, className = "") {
    const value = document.createElement("div");
    value.className = `sc-value${className ? ` ${className}` : ""}`;
    value.textContent = text;
    return value;
  }

  function createScoreValue(score) {
    const value = document.createElement("div");
    value.className = "sc-value sc-score-value";

    if (!score) {
      value.textContent = "-";
      return value;
    }

    for (const image of score.images) {
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || "サクラチェッカーのスコア";
      value.appendChild(img);
    }

    const suffix = document.createElement("span");
    suffix.className = "sc-suffix";
    suffix.textContent = score.suffix;
    value.appendChild(suffix);

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
    openLink.className = "sc-link";
    openLink.href = sourceUrl;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "サクラチェッカーを開く";
    value.appendChild(openLink);

    return value;
  }

  function renderLayout({ score, sourceUrl, statusText }) {
    const root = ensureRoot();
    clearRoot(root);
    appendItem(root, "スコア", createScoreValue(score));
    appendItem(root, "ステータス", createTextValue(statusText, "sc-status-value"));
    appendItem(root, "リンク", createLinkValue(sourceUrl));
  }

  function renderLoading(sourceUrl) {
    const root = ensureRoot();
    root.dataset.state = "loading";
    renderLayout({
      score: null,
      sourceUrl,
      statusText: "取得中",
    });
  }

  function renderSuccess(payload) {
    const root = ensureRoot();
    root.dataset.state = "success";
    renderLayout({
      score: payload.score,
      sourceUrl: payload.sourceUrl,
      statusText: payload.cached ? "取得済み (キャッシュ)" : "取得済み",
    });
  }

  function renderError(payload) {
    const root = ensureRoot();
    root.dataset.state = "error";
    renderLayout({
      score: null,
      sourceUrl: payload && payload.sourceUrl ? payload.sourceUrl : null,
      statusText: "取得失敗",
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
