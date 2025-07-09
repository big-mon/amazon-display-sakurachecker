// Amazon Display Sakura Checker - Content Script
// Amazon商品ページでサクラチェック結果を表示

(function() {
    'use strict';
    
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
    
    // ウィッシュリストページかどうかを判定する関数
    function isWishlistPage() {
        // URLパターンチェック
        const urlPattern = /\/hz\/wishlist|\/gp\/registry\/wishlist/;
        if (urlPattern.test(window.location.pathname)) {
            return true;
        }
        
        // ウィッシュリストページの特徴的な要素の存在チェック
        const wishlistElements = [
            '#g-items',
            '[data-itemid]',
            '.g-item-container',
            '.s-item-container'
        ];
        
        return wishlistElements.some(selector => document.querySelector(selector));
    }
    
    // サクラチェック結果を取得する関数
    async function checkSakuraScore(productURL, asin) {
        try {
            console.log('Amazon Display Sakura Checker: サクラチェック開始');
            
            // sakura-checker.jpにリクエストを送信
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${encodeURIComponent(productURL)}`;
            
            const response = await fetch(sakuraCheckerURL, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                console.error('Amazon Display Sakura Checker: HTTPエラー:', response.status);
                return null;
            }
            
            const html = await response.text();
            console.log('Amazon Display Sakura Checker: レスポンス受信');
            
            // HTMLからサクラ度を抽出
            const sakuraScore = parseSakuraScore(html);
            
            if (sakuraScore !== null) {
                console.log('Amazon Display Sakura Checker: サクラ度:', sakuraScore);
                displaySakuraResult(sakuraScore, asin);
            } else {
                console.log('Amazon Display Sakura Checker: サクラ度を取得できませんでした');
            }
            
        } catch (error) {
            console.error('Amazon Display Sakura Checker: エラー:', error);
        }
    }
    
    // HTMLからサクラ度を解析する関数
    function parseSakuraScore(html) {
        try {
            // 一時的なDOM要素を作成してHTMLを解析
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // サクラ度を示すテキストを検索
            const scoreElements = doc.querySelectorAll('*');
            
            for (const element of scoreElements) {
                const text = element.textContent;
                
                // "サクラ度XX%" のパターンを検索
                const match = text.match(/サクラ度[：:]?\s*(\d+)%/);
                if (match) {
                    return parseInt(match[1]);
                }
                
                // "XX%サクラ" のパターンを検索
                const match2 = text.match(/(\d+)%.*サクラ/);
                if (match2) {
                    return parseInt(match2[1]);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Amazon Display Sakura Checker: HTML解析エラー:', error);
            return null;
        }
    }
    
    // サクラチェック結果を表示する関数
    function displaySakuraResult(sakuraScore, asin) {
        console.log('Amazon Display Sakura Checker: 結果表示準備中', sakuraScore);
        
        // 既存の結果要素を削除
        const existingResult = document.querySelector('#sakura-checker-result');
        if (existingResult) {
            existingResult.remove();
        }
        
        // 結果表示要素を作成
        const resultElement = createResultElement(sakuraScore, asin);
        
        // 挿入位置を特定
        const insertionPoint = findInsertionPoint();
        
        if (insertionPoint) {
            insertionPoint.insertAdjacentElement('afterend', resultElement);
        } else {
            // フォールバック: body要素の最初に追加
            document.body.insertAdjacentElement('afterbegin', resultElement);
        }
    }
    
    // 結果表示要素を作成する関数
    function createResultElement(sakuraScore, asin) {
        const resultDiv = document.createElement('div');
        resultDiv.id = 'sakura-checker-result';
        
        // サクラ度に応じた色とメッセージを決定
        const { color, backgroundColor, message, riskLevel } = getSakuraScoreInfo(sakuraScore);
        
        resultDiv.innerHTML = `
            <div style="
                background-color: ${backgroundColor};
                border: 2px solid ${color};
                border-radius: 8px;
                padding: 12px;
                margin: 10px 0;
                font-family: 'Arial', sans-serif;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                position: relative;
                z-index: 1000;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                ">
                    <span style="
                        background-color: ${color};
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 12px;
                    ">
                        🌸 サクラチェック
                    </span>
                    <span style="
                        font-size: 16px;
                        font-weight: bold;
                        color: ${color};
                    ">
                        ${sakuraScore}%
                    </span>
                    <span style="
                        font-size: 12px;
                        color: #666;
                    ">
                        ${riskLevel}
                    </span>
                </div>
                <div style="
                    font-size: 13px;
                    color: #555;
                    margin-bottom: 8px;
                ">
                    ${message}
                </div>
                <div style="
                    font-size: 11px;
                    color: #999;
                    text-align: right;
                ">
                    Powered by sakura-checker.jp
                </div>
            </div>
        `;
        
        return resultDiv;
    }
    
    // サクラ度に応じた表示情報を取得する関数
    function getSakuraScoreInfo(sakuraScore) {
        if (sakuraScore >= 80) {
            return {
                color: '#dc3545',
                backgroundColor: '#fff5f5',
                message: 'サクラの可能性が非常に高いです。レビューに注意してください。',
                riskLevel: '危険'
            };
        } else if (sakuraScore >= 60) {
            return {
                color: '#fd7e14',
                backgroundColor: '#fff8f0',
                message: 'サクラの可能性があります。レビューを慎重に確認してください。',
                riskLevel: '注意'
            };
        } else if (sakuraScore >= 40) {
            return {
                color: '#ffc107',
                backgroundColor: '#fffef0',
                message: 'レビューに多少の疑問があります。',
                riskLevel: '軽微'
            };
        } else {
            return {
                color: '#28a745',
                backgroundColor: '#f8fff8',
                message: 'レビューは比較的信頼できると思われます。',
                riskLevel: '安全'
            };
        }
    }
    
    // 結果を挿入する位置を特定する関数
    function findInsertionPoint() {
        // 商品タイトルの後に挿入を試みる
        const productTitle = document.querySelector('#productTitle');
        if (productTitle) {
            return productTitle.parentElement;
        }
        
        // 価格情報の前に挿入を試みる
        const priceElement = document.querySelector('#priceblock_dealprice, #priceblock_ourprice, .a-price');
        if (priceElement) {
            return priceElement.parentElement;
        }
        
        // 商品情報エリアを探す
        const productInfo = document.querySelector('#feature-bullets, #productDescription');
        if (productInfo) {
            return productInfo.parentElement;
        }
        
        // フォールバック: レビューセクションの前
        const reviewSection = document.querySelector('#reviews, #reviewsMedley');
        if (reviewSection) {
            return reviewSection.parentElement;
        }
        
        return null;
    }
    
    // ウィッシュリスト内の商品を処理する関数
    async function processWishlistItems() {
        const wishlistItems = extractWishlistItems();
        console.log('Amazon Display Sakura Checker: ウィッシュリスト商品数:', wishlistItems.length);
        
        if (wishlistItems.length === 0) {
            console.log('Amazon Display Sakura Checker: ウィッシュリスト商品が見つかりません');
            return;
        }
        
        // レート制限を考慮して順次処理
        for (let i = 0; i < wishlistItems.length; i++) {
            const item = wishlistItems[i];
            const asin = item.asin;
            
            if (asin) {
                const productURL = generateProductURL(asin);
                console.log(`Amazon Display Sakura Checker: 商品${i+1}/${wishlistItems.length} - ASIN: ${asin}`);
                
                // サクラチェック結果を取得して表示
                await checkSakuraScoreForWishlist(productURL, asin, item.element);
                
                // レート制限のため500ms待機
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    
    // ウィッシュリスト内の商品を抽出する関数
    function extractWishlistItems() {
        const items = [];
        
        // 複数のセレクターを試行
        const selectors = [
            '[data-itemid]',
            '.g-item-container',
            '.s-item-container',
            '[data-asin]'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(element => {
                    const asin = extractASINFromElement(element);
                    if (asin) {
                        items.push({
                            asin: asin,
                            element: element
                        });
                    }
                });
                break;
            }
        }
        
        return items;
    }
    
    // 要素からASINを抽出する関数
    function extractASINFromElement(element) {
        // data-asin属性をチェック
        const dataAsin = element.getAttribute('data-asin');
        if (dataAsin && dataAsin.length === 10) {
            return dataAsin;
        }
        
        // data-itemid属性をチェック
        const dataItemId = element.getAttribute('data-itemid');
        if (dataItemId && dataItemId.length === 10) {
            return dataItemId;
        }
        
        // リンクのhrefからASINを抽出
        const links = element.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]');
        for (const link of links) {
            const href = link.getAttribute('href');
            const match = href.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/);
            if (match) {
                return match[2];
            }
        }
        
        return null;
    }
    
    // ウィッシュリスト用のサクラチェック結果表示
    async function checkSakuraScoreForWishlist(productURL, asin, element) {
        try {
            console.log('Amazon Display Sakura Checker: ウィッシュリスト商品チェック開始');
            
            // sakura-checker.jpにリクエストを送信
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${encodeURIComponent(productURL)}`;
            
            const response = await fetch(sakuraCheckerURL, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                console.error('Amazon Display Sakura Checker: HTTPエラー:', response.status);
                return;
            }
            
            const html = await response.text();
            const sakuraScore = parseSakuraScore(html);
            
            if (sakuraScore !== null) {
                console.log('Amazon Display Sakura Checker: ウィッシュリスト商品サクラ度:', sakuraScore);
                displaySakuraResultForWishlist(sakuraScore, asin, element);
            }
            
        } catch (error) {
            console.error('Amazon Display Sakura Checker: ウィッシュリスト商品チェックエラー:', error);
        }
    }
    
    // ウィッシュリスト用の結果表示
    function displaySakuraResultForWishlist(sakuraScore, asin, element) {
        // 既存の結果要素を削除
        const existingResult = element.querySelector('.sakura-checker-wishlist-result');
        if (existingResult) {
            existingResult.remove();
        }
        
        // 結果表示要素を作成
        const resultElement = createWishlistResultElement(sakuraScore, asin);
        
        // 商品要素に追加
        element.appendChild(resultElement);
    }
    
    // ウィッシュリスト用の結果表示要素を作成
    function createWishlistResultElement(sakuraScore, asin) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'sakura-checker-wishlist-result';
        
        const { color, backgroundColor, riskLevel } = getSakuraScoreInfo(sakuraScore);
        
        resultDiv.innerHTML = `
            <div style="
                background-color: ${backgroundColor};
                border: 1px solid ${color};
                border-radius: 4px;
                padding: 4px 8px;
                margin: 4px 0;
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                line-height: 1.2;
                color: #333;
                display: inline-block;
            ">
                <span style="
                    font-weight: bold;
                    color: ${color};
                ">
                    🌸 ${sakuraScore}% (${riskLevel})
                </span>
            </div>
        `;
        
        return resultDiv;
    }
    
    // メイン処理
    function initialize() {
        if (isProductPage()) {
            const asin = extractProductASIN();
            if (!asin) {
                console.log('Amazon Display Sakura Checker: 商品ASINを取得できませんでした');
                return;
            }
            
            const productURL = generateProductURL(asin);
            console.log('Amazon Display Sakura Checker: 商品URL:', productURL);
            console.log('Amazon Display Sakura Checker: 商品ASIN:', asin);
            
            // サクラチェック結果を取得
            checkSakuraScore(productURL, asin);
        } else if (isWishlistPage()) {
            console.log('Amazon Display Sakura Checker: ウィッシュリストページを検出');
            processWishlistItems();
        } else {
            console.log('Amazon Display Sakura Checker: 対象ページではありません');
        }
    }
    
    // ページ読み込み完了後に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // 動的ページ変更への対応
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // ページ内容が変更された場合、再初期化
                setTimeout(initialize, 1000);
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();