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

module.exports = {
  htmlWithInjectedScore,
  injectedDecodedScript,
  injectedPayload,
  injectedScoreMarkup,
  injectedScript,
  otherReviewWrap,
  sampleHtml,
  sampleImageTag,
  scrambledScoreValue,
  targetReviewWrap,
  verdictImageTag,
};
