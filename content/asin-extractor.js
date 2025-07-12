// ASIN抽出機能モジュール
// Amazon商品ページからASINを抽出し、商品URLを生成する

// 商品ASINを抽出する関数
function extractProductASIN() {
    // 1. URLからASINを抽出
    const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
    if (urlMatch) {
        return urlMatch[1] || urlMatch[2];
    }
    
    // 2. meta要素からASINを抽出
    const metaASIN = document.querySelector('meta[name="title"]');
    if (metaASIN) {
        const content = metaASIN.getAttribute('content');
        const asinMatch = content.match(/([A-Z0-9]{10})/);
        if (asinMatch) {
            return asinMatch[1];
        }
    }
    
    // 3. DOM要素からASINを抽出
    const asinElement = document.querySelector('[data-asin]');
    if (asinElement) {
        const asin = asinElement.getAttribute('data-asin');
        if (asin && asin.length === 10) {
            return asin;
        }
    }
    
    return null;
}

// 商品URLを生成する関数
function generateProductURL(asin) {
    // 現在のURLが既に適切な形式の場合はそのまま使用
    const currentURL = window.location.href;
    
    // 現在のURLにASINが含まれている場合は、そのURLを使用
    if (currentURL.includes(asin)) {
        // URLのクエリパラメータやハッシュを除去してクリーンなURLにする
        const url = new URL(currentURL);
        const cleanURL = `${url.protocol}//${url.hostname}${url.pathname}`;
        return cleanURL.endsWith('/') ? cleanURL.slice(0, -1) : cleanURL;
    }
    
    // フォールバック: 標準的なdp/形式で生成
    const currentDomain = window.location.hostname;
    return `https://${currentDomain}/dp/${asin}`;
}

// 商品ページかどうかを判定する関数
function isProductPage() {
    // URLパターンチェック
    const urlPattern = /\/(dp|gp\/product)\/[A-Z0-9]{10}/;
    if (urlPattern.test(window.location.pathname)) {
        return true;
    }
    
    // 商品ページの特徴的な要素の存在チェック
    const productElements = [
        '#productTitle',
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        '#add-to-cart-button',
        '#buy-now-button'
    ];
    
    return productElements.some(selector => document.querySelector(selector));
}

// エクスポート（グローバルスコープで利用可能にする）
window.AsinExtractor = {
    extractProductASIN,
    generateProductURL,
    isProductPage
};