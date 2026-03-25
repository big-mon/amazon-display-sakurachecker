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

const targetedSecondaryItemInfo = `
  <div class="item-info targeted-secondary">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-rating"><span>${sampleImageTag}${otherImageTag}${sampleImageTag.replace('alt="score"', 'alt="bonus-1"')}</span>/5</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv01"><img src="/images/rv_level01.png" alt="verdict"></p>
        <p class="item-rv-score">別商品の比較カード</p>
        <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" class="button button-blue button-mini" target="_blank" rel="nofollow">他商品</a>
      </div>
    </div>
  </div>
`;

const targetedPrimaryItemInfo = `
  <div class="item-info targeted-primary">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="target-digit"')}</span>/5</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv03"><img src="/images/rv_level03.png" alt="target verdict"></p>
        <p class="item-rv-score">対象商品のスコア</p>
      </div>
    </div>
  </div>
`;

const targetedRenderedProductHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedPrimaryItemInfo}
      </div>
    </body>
  </html>
`;

const targetedUnavailablePrimaryItemInfo = `
  <div class="item-info targeted-unavailable">
    <div class="item-review-box">
      <div class="item-review-after"></div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv00"><img src="/images/rv_level00.png" alt="unavailable verdict"></p>
        <p class="item-rv-score">Insufficient reviews to calculate a score</p>
      </div>
    </div>
  </div>
`;

const targetedUnavailableProductHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0CPS3DZ3H/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedUnavailablePrimaryItemInfo}
      </div>
    </body>
  </html>
`;

const targetedRenderedLoadingHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        <div id="target-loader" class="loader"></div>
      </div>
    </body>
  </html>
`;

const targetedRenderedLoadingWithVerdictHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        <div class="item-info targeted-loading-with-verdict">
          <div class="item-review-box">
            <div class="item-review-level">
              <p class="item-rv-score">読み込み中</p>
            </div>
          </div>
          <div id="target-loader-with-verdict" class="loader"></div>
        </div>
      </div>
    </body>
  </html>
`;

const wrapperScopedOtherItemInfo = `
  <div class="item-info wrapper-scoped-other">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-rating"><span>${sampleImageTag}${otherImageTag}${sampleImageTag.replace('alt="score"', 'alt="other-bonus"')}</span>/5</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv01"><img src="/images/rv_level01.png" alt="other verdict"></p>
        <p class="item-rv-score">莉門膚蜩・ｽ懷・繧ｹ繧ｳ繧｢</p>
        <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" class="button button-blue button-mini" target="_blank" rel="nofollow">莉門膚蜩・/a>
      </div>
    </div>
  </div>
`;

const wrapperScopedTargetItemInfo = `
  <div class="item-info wrapper-scoped-target">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-rating"><span>${sampleImageTag.replace('alt="score"', 'alt="target-only"')}</span>/5</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv03"><img src="/images/rv_level03.png" alt="target verdict"></p>
        <p class="item-rv-score">蟇ｾ雎｡蝠・刀縺ｮ繧ｹ繧ｳ繧｢</p>
        <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" class="button button-blue button-mini" target="_blank" rel="nofollow">蟇ｾ雎｡蝠・/a>
      </div>
    </div>
  </div>
`;

const wrapperScopedLegacyHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${wrapperScopedOtherItemInfo}
        ${wrapperScopedTargetItemInfo}
      </div>
    </body>
  </html>
`;

const wrapperScopedUnavailableItemInfo = `
  <div class="item-info wrapper-scoped-unavailable">
    <div class="item-review-box">
      <div class="item-review-after"></div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv00"><img src="/images/rv_level00.png" alt="unavailable verdict"></p>
        <p class="item-rv-score">Not enough reviews for a Sakura Checker score</p>
      </div>
    </div>
  </div>
`;

const wrapperScopedOtherUnavailableItemInfo = `
  <div class="item-info wrapper-scoped-other-unavailable">
    <div class="item-review-box">
      <div class="item-review-after"></div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv00"><img src="/images/rv_level00.png" alt="other unavailable verdict"></p>
        <p class="item-rv-score">Comparison card has no score yet</p>
      </div>
    </div>
  </div>
`;

const wrapperScopedUnavailableLegacyHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${wrapperScopedOtherUnavailableItemInfo}
        ${wrapperScopedUnavailableItemInfo}
      </div>
    </body>
  </html>
`;

const repeatedDigitImageTag = '<img src="data:image/png;base64,LOWDIGIT" alt="repeat-digit">';
const narrowSeparatorImageTag = '<img src="data:image/png;base64,SEPARATOR" alt="separator">';
const distinctLargeImageTag = '<img src="data:image/png;base64,HIGH-A" alt="distinct-large">';
const distinctWideImageTag = '<img src="data:image/png;base64,HIGH-B" alt="distinct-wide">';
const distinctMediumImageTag = '<img src="data:image/png;base64,HIGH-C" alt="distinct-medium">';
const distinctTailImageTag = '<img src="data:image/png;base64,HIGH-D" alt="distinct-tail">';

const lowCountLegacyItemInfo = `
  <div class="item-info low-count">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-logo"><img src="/images/logo_s.png" alt="logo"></p>
        <p class="item-rating"><span>${repeatedDigitImageTag}${narrowSeparatorImageTag}${repeatedDigitImageTag}${repeatedDigitImageTag}${repeatedDigitImageTag}</span>/5</p>
        <p class="item-num"><span class="boldtxt">142件</span>の評価</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv04"><img src="/images/rv_level04.png" alt="lower"></p>
        <p class="item-rv-score">Amazonより<br>かなり低いスコア</p>
        <a href="https://www.amazon.co.jp/gp/customer-reviews/R5JSDCZSAXGHW7/" class="button button-blue button-mini" target="_blank" rel="nofollow">サゲ評価</a>
      </div>
    </div>
  </div>
`;

const highCountLegacyItemInfo = `
  <div class="item-info high-count">
    <div class="item-review-box">
      <div class="item-review-after">
        <p class="item-logo"><img src="/images/logo_s.png" alt="logo"></p>
        <p class="item-rating"><span>${distinctLargeImageTag}${narrowSeparatorImageTag}${distinctWideImageTag}${distinctMediumImageTag}${distinctTailImageTag}</span>/5</p>
        <p class="item-num"><span class="boldtxt">18177件</span>の評価</p>
      </div>
      <div class="item-review-level">
        <p class="item-rv-lv item-rv-lv01"><img src="/images/rv_level01.png" alt="higher"></p>
        <p class="item-rv-score">Amazonと<br>同等のスコア</p>
        <a href="https://www.amazon.co.jp/gp/customer-reviews/R194PYLE36254E/" class="button button-blue button-mini" target="_blank" rel="nofollow">高評価</a>
      </div>
    </div>
  </div>
`;

const sameWrapReviewCountTiebreakHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B095JGJCC7/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${lowCountLegacyItemInfo}
        ${highCountLegacyItemInfo}
      </div>
    </body>
  </html>
`;

const renderedModernWithUnrelatedLegacyHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="sakuraBlock">
        <p class="sakura-alert">郢ｧ・ｵ郢ｧ・ｯ郢晢ｽｩ陟趣ｽｦ邵ｺ・ｯ<span class="sakura-num">${sampleImageTag}<span class="sakura-num-per">${otherImageTag}</span></span>邵ｺ・ｧ邵ｺ蜷ｶﾂ繝ｻ/p>
        <span class="sakura-msg is-size-6">陞ｳ迚吶・邵ｺ・ｪ陜繝ｻ蛻邵ｺ・ｧ邵ｺ蜻ｻ・ｼ繝ｻ/span>
        <p class="image sakura-rating"><img src="/images/sakura_lv00.png" alt="陞ｳ迚吶・"></p>
      </div>
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

const fixedRenderedModernWithUnrelatedLegacyHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="sakuraBlock">
        ${modernSakuraAlertMarkup}
        ${modernSakuraRatingMarkup}
      </div>
    </body>
  </html>
`;

const ambiguousWrapperWithModernHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B095JGJCC7/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${lowCountLegacyItemInfo}
        ${highCountLegacyItemInfo}
      </div>
      <div class="sakuraBlock">
        ${modernSakuraAlertMarkup}
        ${modernSakuraRatingMarkup}
      </div>
    </body>
  </html>
`;

const targetedRenderedLoadingWithModernHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0OTHER999/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        ${targetedSecondaryItemInfo}
      </div>
      <div class="item-review-wrap">
        <div class="item-image">
          <a href="https://www.amazon.co.jp/dp/B0TARGET42/?tag=sakurachecker-22" target="_blank" class="linkimg"></a>
        </div>
        <div id="target-loader" class="loader"></div>
      </div>
      ${modernSakuraAlertMarkup}
      ${modernSakuraRatingMarkup}
    </body>
  </html>
`;

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

const fixedRenderedModernHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="sakuraBlock">
        ${modernSakuraAlertMarkup}
        ${modernSakuraRatingMarkup}
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

const renderedBlockedHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <head>
      <title>Too Many Requests</title>
    </head>
    <body>
      <main>
        <h1>アクセスが集中しています</h1>
        <p>しばらく待ってから再度お試しください。</p>
      </main>
    </body>
  </html>
`;

const itemSearchResultHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div class="list-wrap marginsideless-sp">
        <div name="searchitem" sakura="90">
          <div class="is-flex list-box">
            <div class="list-item-image">
              <a href="https://www.amazon.co.jp/dp/B091BGMKYS?tag=sakurachecker-22&linkCode=osi&th=1&psc=1" target="_blank" class="linkimg"></a>
            </div>
            <div class="list-info">
              <p class="item-name">
                UGREEN Nexode 65W
                <a href="https://www.amazon.co.jp/dp/B091BGMKYS?tag=sakurachecker-22&linkCode=osi&th=1&psc=1" rel="nofollow" target="_blank">...</a>
              </p>
              <p class="item-info">
                <span class="item-rating"><span>1.93</span>/5</span>
                <span class="item-rvnum">(7844件)</span>
                <span class="item-sakura">サクラ度<span class="is-size-7">90%</span></span>
                <span class="item-lv item-lv04">危険</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const itemSearchNoResultsHtml = `
  <!DOCTYPE html>
  <html lang="ja">
    <body>
      <div id="javascriptEnabled">
        <p>商品名検索では商品が見つかりませんでした。</p>
        <p>アマゾン製品URLでのURL検索をお試し下さい。URLでは必ず検出できます。</p>
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
  ambiguousWrapperWithModernHtml,
  comparisonHeavyProductHtml,
  comparisonPrimaryItemInfo,
  comparisonSecondaryItemInfo,
  htmlWithInjectedScore,
  itemSearchNoResultsHtml,
  itemSearchResultHtml,
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
  fixedRenderedModernHtml,
  fixedRenderedModernWithUnrelatedLegacyHtml,
  realisticPageHtml,
  renderedLoadingHtml,
  renderedBlockedHtml,
  renderedModernWithUnrelatedLegacyHtml,
  renderedModernHtml,
  sampleHtml,
  sampleImageTag,
  sameWrapReviewCountTiebreakHtml,
  scrambledScoreValue,
  targetedRenderedLoadingHtml,
  targetedRenderedLoadingWithVerdictHtml,
  targetedRenderedLoadingWithModernHtml,
  targetedRenderedProductHtml,
  targetedUnavailableProductHtml,
  targetReviewWrap,
  verdictImageTag,
  wrapperScopedLegacyHtml,
  wrapperScopedUnavailableLegacyHtml,
};
