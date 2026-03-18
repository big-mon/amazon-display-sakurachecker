const scrambledScoreValue = [
  "1WRVVBQUFEbE4wL2xOMC9sTjAvbE4wL2xOMC9sTjAvbE4wL2xOMCtBazVsZkFBQUFD",
  "SFJTVGxNQVFMK0F6NDhnRU9YaW9NRUFBQUE1U1VSQlZEakxZeGdGRkFNMll5REFLc1BZ",
  "QVFTak1zTkNSZ2tLVkVBeU1JNHFTS1lERzJnYTdESURINkZGF0YTppbWFnZS9wbmc7YmFz",
  "ZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFESUFBQUJEQkFNQUFBQXNiMHZtQUFBQUcx",
  "QktqTW9OSmhsMFFDQmlHTmdBQWVNZW9NNEZ1aHZJQUFBQUFTVVZPUks1Q1lJST0=",
].join("");

const sampleImageTag = [
  '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"',
  'alt="score"',
  `KTzIOIAzVx2Qrw5_="${scrambledScoreValue}"`,
  `onload="var _s=this['getAttribute']('KTzIOIAzVx2Qrw5_');var _n=98;var _m=62;"`,
  ">",
].join(" ");

const otherImageTag = sampleImageTag.replace('alt="score"', 'alt="other"');
const verdictImageTag = '<img src=/images/rv_level03.png alt="判定">';
const fallbackVerdictImageTag = '<img src=/images/rv_level00.png alt="判定">';

const otherReviewWrap = `
  <div class="item-review-wrap">
    <div class="item-image">
      <a href="https://www.amazon.co.jp/dp/B000000000/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
    </div>
    <div class="item-info sample-other">
      <div class="item-review-box">
        <div class="item-review-after">
          <p class="item-rating"><span>${otherImageTag}</span>/5</p>
          <div class="item-review-level">
            <p class="item-rv-lv item-rv-lv00">${fallbackVerdictImageTag}</p>
            <p class="item-rv-score">評価件数不足で<br>分析不可</p>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const targetReviewWrap = `
  <div class="item-review-wrap">
    <div class="item-image">
      <a href="https://www.amazon.co.jp/dp/B08N5WRWNW/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
    </div>
    <div class="item-info sample-target">
      <div class="item-review-box">
        <div class="item-review-after">
          <p class="item-rating"><span>${sampleImageTag}</span>/5</p>
          <div class="item-review-level">
            <p class="item-rv-lv item-rv-lv03">${verdictImageTag}</p>
            <p class="item-rv-score">Amazonより<br>かなり低いスコア</p>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const sampleHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      ${otherReviewWrap}
      ${targetReviewWrap}
      <p class="item-btn"><a href="https://www.amazon.co.jp/dp/B08N5WRWNW/?tag=sakurachecker-22"></a></p>
    </body>
  </html>
`;

const injectedScoreMarkup = `
  <div class="item-review-after">
    <p class="item-logo"><img src="/images/logo_s.png" alt="サクラチェッカー"></p>
    <p class="item-rating"><span>${sampleImageTag}${otherImageTag}</span>/5</p>
  </div>
  <div class="item-review-level">
    <p class="item-rv-lv item-rv-lv02">${verdictImageTag}</p>
    <p class="item-rv-score">Amazonと<br>同等のスコア</p>
  </div>
`;

const injectedPayload = Buffer.from(encodeURIComponent(injectedScoreMarkup), "utf8").toString(
  "base64"
);

const injectedDecodedScript = `
  var injectedPayload = '${injectedPayload}';
  $(function () {
    $("#dynamic-score-anchor").before(decodeURIComponent(atob(injectedPayload)));
    $("#dynamic-score-anchor").remove();
  });
`;

const injectedScript = `
  var _0x = "eval";
  window[_0x]('${Buffer.from(injectedDecodedScript, "utf8").toString("base64")}');
`;

const htmlWithInjectedScore = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      ${targetReviewWrap}
      <div class="item-review-box"><span id="dynamic-score-anchor"></span></div>
      <script>${injectedScript}</script>
    </body>
  </html>
`;

const realisticPageHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <head>
      <title>Sakura Checker search result</title>
    </head>
    <body>
      <main id="contents">
        <section class="search-results">
          <div class="item-review-wrap">
            <div class="item-image">
              <a
                href="https://www.amazon.co.jp/gp/product/B095JGJCC7?ref_=sakura_checker"
                target="_blank"
                class="linkimg"
              ></a>
            </div>
            <div class="item-info actual-layout">
              <div class="item-review-box">
                <div class="item-review-after">
                  <p class="item-logo"><img src="/images/logo_s.png" alt="logo"></p>
                  <p class="item-rating"><span>${sampleImageTag}${otherImageTag}</span>/5</p>
                  <div class="item-review-level">
                    <p class="item-rv-lv item-rv-lv03">${verdictImageTag}</p>
                    <p class="item-rv-score">Amazonより<br>危険なスコア</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </body>
  </html>
`;

const multiRatingNoVerdictWrap = `
  <div class="item-review-wrap">
    <div class="item-image">
      <a href="https://www.amazon.co.jp/dp/B0MULTI123/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
    </div>
    <div class="item-info actual-layout">
      <div class="item-review-box">
        <div class="item-review-after">
          <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="digit-1"')}</span>/5</p>
          <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="digit-2"')}</span>/5</p>
          <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="digit-3"')}</span>/5</p>
        </div>
      </div>
    </div>
  </div>
`;

const multiRatingNoVerdictHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      ${multiRatingNoVerdictWrap}
    </body>
  </html>
`;

const comparisonSecondaryItemInfo = `
  <div class="item-info comparison-secondary">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-logo"><img src="/images/logo_s.png" alt="logo"></p>
        <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="secondary-digit"')}</span>/5</p>
        <p class="item-num"><span class="boldtxt">12件</span>の評価</p>
        <p class="item-rank"><a href="/ranking/1/">ランキング<span><span class="num">88</span>位</span></a></p>
      </div>
    </div>
  </div>
`;

const comparisonPrimaryItemInfo = `
  <div class="item-info comparison-primary">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-logo"><img src="/images/logo_s.png" alt="logo"></p>
        <p class="item-rating"><span>${sampleImageTag}${otherImageTag}${sampleImageTag.replace('alt="score"', 'alt="plus"')}</span>/5</p>
        <span class="is-size-7">※他社からのサゲ評価検出<br>本来は更に高いスコア</span>
        <p class="item-num"><span class="boldtxt">18177件</span>の評価</p>
        <p class="item-rank"><a href="/ranking/3457072051/">ランキング<span><span class="num">40</span>位</span></a></p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv01"><img src="/images/rv_level01.png" alt="verdict"></p>
        <p class="item-rv-score">Amazonと<br>同等のスコア</p>
        <a href="https://www.amazon.co.jp/gp/customer-reviews/R194PYLE36254E/" class="button button-blue button-mini" target="_blank" rel="nofollow">
          <img src="/images/icon_rv01.png" alt="best" class="icon">最も信頼できる高評価
        </a>
      </div>
    </div>
  </div>
`;

const comparisonHeavyProductHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0COMPARE1/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${comparisonSecondaryItemInfo}
        ${comparisonPrimaryItemInfo}
      </div>
      <p class="item-btn"><a href="https://www.amazon.co.jp/dp/B0COMPARE1/?tag=sakurachecker-22"></a></p>
    </body>
  </html>
`;

const modernSakuraAlertMarkup = `
  <p class="sakura-alert">サクラ度は<span class="sakura-num">${sampleImageTag}<span class="sakura-num-per">${otherImageTag}</span></span>です。</p>
  <span class="sakura-msg is-size-6">安全な商品です！</span>
`;

const modernSakuraRatingMarkup = `
  <p class="image sakura-rating"><img src="/images/sakura_lv00.png" alt="安全"></p>
`;

const modernSakuraAlertPayload = Buffer.from(
  encodeURIComponent(modernSakuraAlertMarkup),
  "utf8"
).toString("base64");

const modernSakuraRatingPayload = Buffer.from(
  encodeURIComponent(modernSakuraRatingMarkup),
  "utf8"
).toString("base64");

const modernInjectedHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="sakuraBlock">
        <div class="inner">
          <span id="modernAlertAnchor"></span>
          <span id="modernRatingAnchor"></span>
          <script>
            var alertPayload = '${modernSakuraAlertPayload}';
            $(function () {
              $("#modernAlertAnchor").before(decodeURIComponent(atob(alertPayload)));
            });
            var ratingPayload = '${modernSakuraRatingPayload}';
            $(function () {
              $("#modernRatingAnchor").before(decodeURIComponent(atob(ratingPayload)));
              $("#modernRatingAnchor").remove();
            });
          </script>
        </div>
      </div>
    </body>
  </html>
`;

const renderedModernHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="sakuraBlock">
        <p class="sakura-alert">繧ｵ繧ｯ繝ｩ蠎ｦ縺ｯ<span class="sakura-num">${sampleImageTag}<span class="sakura-num-per">${otherImageTag}</span></span>縺ｧ縺吶・/p>
        <span class="sakura-msg is-size-6">螳牙・縺ｪ蝠・刀縺ｧ縺呻ｼ・/span>
        <p class="image sakura-rating"><img src="/images/sakura_lv00.png" alt="螳牙・"></p>
      </div>
    </body>
  </html>
`;

const renderedLoadingHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div id="pagetop">
        <div class="loader"></div>
      </div>
    </body>
  </html>
`;

const productAndModernHtml = sampleHtml.replace(
  "</body>",
  `
      <div class="sakuraBlock">
        <div class="inner">
          <span id="modernAlertAnchor"></span>
          <span id="modernRatingAnchor"></span>
          <script>
            var alertPayload = '${modernSakuraAlertPayload}';
            $(function () {
              $("#modernAlertAnchor").before(decodeURIComponent(atob(alertPayload)));
            });
            var ratingPayload = '${modernSakuraRatingPayload}';
            $(function () {
              $("#modernRatingAnchor").before(decodeURIComponent(atob(ratingPayload)));
              $("#modernRatingAnchor").remove();
            });
          </script>
        </div>
      </div>
    </body>`
);

module.exports = {
  comparisonHeavyProductHtml,
  comparisonPrimaryItemInfo,
  comparisonSecondaryItemInfo,
  htmlWithInjectedScore,
  injectedDecodedScript,
  injectedPayload,
  injectedScoreMarkup,
  injectedScript,
  modernInjectedHtml,
  modernSakuraAlertMarkup,
  modernSakuraRatingMarkup,
  multiRatingNoVerdictHtml,
  multiRatingNoVerdictWrap,
  otherReviewWrap,
  productAndModernHtml,
  realisticPageHtml,
  renderedLoadingHtml,
  renderedModernHtml,
  sampleHtml,
  sampleImageTag,
  scrambledScoreValue,
  targetReviewWrap,
  verdictImageTag,
};
