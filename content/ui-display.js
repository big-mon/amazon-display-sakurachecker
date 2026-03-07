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
        padding: 16px;
        margin: 12px 0;
        box-shadow: 0 1px 3px rgba(15, 17, 17, 0.08);
        color: #0f1111;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
      }

      #${ROOT_ID} .sc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      #${ROOT_ID} .sc-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: #232f3e;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
      }

      #${ROOT_ID} .sc-status {
        font-size: 13px;
        color: #565959;
      }

      #${ROOT_ID} .sc-score {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 28px;
      }

      #${ROOT_ID} .sc-primary {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 20px;
        margin-bottom: 10px;
      }

      #${ROOT_ID} .sc-score img {
        max-height: 28px;
        width: auto;
        display: block;
      }

      #${ROOT_ID} .sc-verdict {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 28px;
      }

      #${ROOT_ID} .sc-verdict img {
        max-height: 32px;
        width: auto;
        display: block;
      }

      #${ROOT_ID} .sc-verdict-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.35;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-suffix {
        font-size: 18px;
        font-weight: 700;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-message {
        font-size: 14px;
        line-height: 1.5;
        color: #0f1111;
      }

      #${ROOT_ID} .sc-meta {
        font-size: 12px;
        color: #565959;
        margin-top: 8px;
      }

      #${ROOT_ID} .sc-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      #${ROOT_ID} .sc-button,
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
      }

      #${ROOT_ID} .sc-button:hover,
      #${ROOT_ID} .sc-link:hover {
        background: #f7fafa;
      }

      #${ROOT_ID}[data-state="error"] {
        border-left-color: #b12704;
      }

      #${ROOT_ID}[data-state="loading"] {
        border-left-color: #007185;
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

  function appendHeader(root, statusText) {
    const header = document.createElement("div");
    header.className = "sc-header";

    const badge = document.createElement("span");
    badge.className = "sc-badge";
    badge.textContent = "サクラチェッカー";

    const status = document.createElement("span");
    status.className = "sc-status";
    status.textContent = statusText;

    header.appendChild(badge);
    header.appendChild(status);
    root.appendChild(header);
  }

  function appendActions(root, options) {
    const actions = document.createElement("div");
    actions.className = "sc-actions";

    if (options.onRetry) {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "sc-button";
      retryButton.textContent = "再試行";
      retryButton.addEventListener("click", options.onRetry);
      actions.appendChild(retryButton);
    }

    if (options.sourceUrl) {
      const openLink = document.createElement("a");
      openLink.className = "sc-link";
      openLink.href = options.sourceUrl;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.textContent = "サクラチェッカーを開く";
      actions.appendChild(openLink);
    }

    root.appendChild(actions);
  }

  function renderLoading() {
    const root = ensureRoot();
    root.dataset.state = "loading";
    clearRoot(root);
    appendHeader(root, "取得中");

    const message = document.createElement("div");
    message.className = "sc-message";
    message.textContent =
      "サクラチェッカーからスコア画像を取得しています。";
    root.appendChild(message);
  }

  function renderSuccess(payload, onRetry) {
    const root = ensureRoot();
    root.dataset.state = "success";
    clearRoot(root);
    appendHeader(root, payload.cached ? "キャッシュ表示" : "取得完了");

    const primary = document.createElement("div");
    primary.className = "sc-primary";

    const score = document.createElement("div");
    score.className = "sc-score";

    for (const image of payload.score.images) {
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || "サクラチェッカーのスコア";
      score.appendChild(img);
    }

    const suffix = document.createElement("span");
    suffix.className = "sc-suffix";
    suffix.textContent = payload.score.suffix;
    score.appendChild(suffix);
    primary.appendChild(score);

    if (payload.verdict && payload.verdict.image && payload.verdict.lines?.length) {
      const verdict = document.createElement("div");
      verdict.className = "sc-verdict";

      const icon = document.createElement("img");
      icon.src = payload.verdict.image.src;
      icon.alt = payload.verdict.image.alt || "サクラチェッカーの判定";
      verdict.appendChild(icon);

      const text = document.createElement("div");
      text.className = "sc-verdict-text";
      for (const line of payload.verdict.lines) {
        const lineElement = document.createElement("span");
        lineElement.textContent = line;
        text.appendChild(lineElement);
      }

      verdict.appendChild(text);
      primary.appendChild(verdict);
    }

    root.appendChild(primary);

    const message = document.createElement("div");
    message.className = "sc-message";
    message.textContent =
      "サクラチェッカー上で表示されているスコア画像をそのまま表示しています。";
    root.appendChild(message);

    const meta = document.createElement("div");
    meta.className = "sc-meta";
    meta.textContent = `取得日時: ${new Date(payload.fetchedAt).toLocaleString("ja-JP")}`;
    root.appendChild(meta);

    appendActions(root, { onRetry, sourceUrl: payload.sourceUrl });
  }

  function renderError(payload, onRetry) {
    const root = ensureRoot();
    root.dataset.state = "error";
    clearRoot(root);
    appendHeader(root, "取得失敗");

    const message = document.createElement("div");
    message.className = "sc-message";
    message.textContent =
      payload && payload.message
        ? payload.message
        : "サクラチェッカーのスコア画像を取得できませんでした。";
    root.appendChild(message);

    appendActions(root, {
      onRetry,
      sourceUrl: payload && payload.sourceUrl ? payload.sourceUrl : null,
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
