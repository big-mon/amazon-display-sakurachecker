// Amazon Display Sakura Checker - Content Script
// Amazon商品ページでサクラチェック結果を表示

(function() {
    'use strict';
    
    // 処理中のASINを追跡して重複実行を防止
    const processingASINs = new Set();
    let isInitialized = false;
    
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
    
    // Background Scriptにサクラチェックを依頼する関数
    async function checkSakuraScore(productURL, asin) {
        // 重複実行を防止
        if (processingASINs.has(asin)) {
            console.log('Amazon Display Sakura Checker: 既に処理中です - ASIN:', asin);
            return;
        }
        
        // 既存の結果がある場合はスキップ
        const existingResult = document.querySelector('#sakura-checker-result');
        if (existingResult && !existingResult.textContent.includes('調査中') && !existingResult.textContent.includes('エラー')) {
            console.log('Amazon Display Sakura Checker: 既に結果が表示されています - ASIN:', asin);
            return;
        }
        
        processingASINs.add(asin);
        
        try {
            console.log('Amazon Display Sakura Checker: サクラチェック開始 - ASIN:', asin);
            
            // 読み込み中の表示を設定
            displayLoadingResult(asin);
            
            // Chrome拡張機能のランタイムが利用可能かチェック
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                throw new Error('Chrome拡張機能のランタイムが利用できません');
            }
            
            // Background Scriptにメッセージを送信（タイムアウト付き）
            const response = await Promise.race([
                chrome.runtime.sendMessage({
                    action: 'checkSakuraScore',
                    productURL: productURL,
                    asin: asin
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Background Scriptからの応答がタイムアウトしました')), 45000)
                )
            ]);
            
            if (response && response.success) {
                console.log('Amazon Display Sakura Checker: サクラ度:', response.sakuraScore);
                displaySakuraResult(response.sakuraScore, asin);
            } else {
                console.error('Amazon Display Sakura Checker: エラー:', response?.error || 'レスポンスが不正です');
                displayErrorResult(response?.error || 'サクラ度を取得できませんでした', asin);
            }
            
        } catch (error) {
            console.error('Amazon Display Sakura Checker: 通信エラー:', error);
            let errorMessage = '通信に失敗しました';
            
            if (error.message.includes('Extension context invalidated')) {
                errorMessage = '拡張機能を再読み込みしてください';
            } else if (error.message.includes('タイムアウト')) {
                errorMessage = 'リクエストがタイムアウトしました';
            } else if (error.message.includes('ランタイムが利用できません')) {
                errorMessage = 'Chrome拡張機能として正しく読み込まれていません';
            }
            
            displayErrorResult(errorMessage, asin);
        } finally {
            // 処理完了時にASINを削除
            processingASINs.delete(asin);
        }
    }
    
    // 読み込み中の表示を行う関数
    function displayLoadingResult(asin) {
        // 既存の結果要素を削除
        const existingResult = document.querySelector('#sakura-checker-result');
        if (existingResult) {
            existingResult.remove();
        }
        
        // 読み込み中表示要素を作成
        const loadingElement = createLoadingElement(asin);
        
        // 挿入位置を特定
        const insertionPoint = findInsertionPoint();
        
        if (insertionPoint) {
            insertionPoint.insertAdjacentElement('afterend', loadingElement);
        } else {
            document.body.insertAdjacentElement('afterbegin', loadingElement);
        }
    }
    
    // 読み込み中要素を作成する関数
    function createLoadingElement(asin) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'sakura-checker-result';
        
        loadingDiv.innerHTML = `
            <div style="
                background-color: #f8f9fa;
                border: 2px solid #6c757d;
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
                        background-color: #6c757d;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 12px;
                    ">
                        🌸 サクラチェック
                    </span>
                    <span style="
                        font-size: 14px;
                        color: #6c757d;
                    ">
                        調査中...
                    </span>
                </div>
                <div style="
                    font-size: 13px;
                    color: #555;
                    margin-bottom: 8px;
                ">
                    サクラ度を調査しています。しばらくお待ちください。
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
        
        return loadingDiv;
    }
    
    // エラー表示を行う関数
    function displayErrorResult(errorMessage, asin) {
        // 既存の結果要素を削除
        const existingResult = document.querySelector('#sakura-checker-result');
        if (existingResult) {
            existingResult.remove();
        }
        
        // エラー表示要素を作成
        const errorElement = createErrorElement(errorMessage, asin);
        
        // 挿入位置を特定
        const insertionPoint = findInsertionPoint();
        
        if (insertionPoint) {
            insertionPoint.insertAdjacentElement('afterend', errorElement);
        } else {
            document.body.insertAdjacentElement('afterbegin', errorElement);
        }
    }
    
    // エラー要素を作成する関数
    function createErrorElement(errorMessage, asin) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'sakura-checker-result';
        
        errorDiv.innerHTML = `
            <div style="
                background-color: #fff3cd;
                border: 2px solid #ffc107;
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
                        background-color: #ffc107;
                        color: #212529;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 12px;
                    ">
                        ⚠️ サクラチェック
                    </span>
                    <span style="
                        font-size: 14px;
                        color: #856404;
                    ">
                        エラー
                    </span>
                </div>
                <div style="
                    font-size: 13px;
                    color: #555;
                    margin-bottom: 8px;
                ">
                    ${errorMessage}
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
        
        return errorDiv;
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
        // 重複実行を防止
        if (processingASINs.has(asin)) {
            console.log('Amazon Display Sakura Checker: ウィッシュリスト商品既に処理中 - ASIN:', asin);
            return;
        }
        
        // 既存の結果がある場合はスキップ
        const existingResult = element.querySelector('.sakura-checker-wishlist-result');
        if (existingResult) {
            console.log('Amazon Display Sakura Checker: ウィッシュリスト商品既に結果表示済み - ASIN:', asin);
            return;
        }
        
        processingASINs.add(asin);
        
        try {
            console.log('Amazon Display Sakura Checker: ウィッシュリスト商品チェック開始 - ASIN:', asin);
            
            // Chrome拡張機能のランタイムが利用可能かチェック
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                throw new Error('Chrome拡張機能のランタイムが利用できません');
            }
            
            // Background Scriptにメッセージを送信（タイムアウト付き）
            const response = await Promise.race([
                chrome.runtime.sendMessage({
                    action: 'checkSakuraScore',
                    productURL: productURL,
                    asin: asin
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Background Scriptからの応答がタイムアウトしました')), 45000)
                )
            ]);
            
            if (response && response.success) {
                console.log('Amazon Display Sakura Checker: ウィッシュリスト商品サクラ度:', response.sakuraScore);
                displaySakuraResultForWishlist(response.sakuraScore, asin, element);
            } else {
                console.error('Amazon Display Sakura Checker: ウィッシュリスト商品チェックエラー:', response?.error || 'レスポンスが不正です');
            }
            
        } catch (error) {
            console.error('Amazon Display Sakura Checker: ウィッシュリスト商品通信エラー:', error);
        } finally {
            // 処理完了時にASINを削除
            processingASINs.delete(asin);
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
        // 重複初期化を防止
        if (isInitialized) {
            console.log('Amazon Display Sakura Checker: 既に初期化済みです');
            return;
        }
        
        console.log('Amazon Display Sakura Checker: 初期化開始');
        
        if (isProductPage()) {
            const asin = extractProductASIN();
            if (!asin) {
                console.log('Amazon Display Sakura Checker: 商品ASINを取得できませんでした');
                return;
            }
            
            const productURL = generateProductURL(asin);
            console.log('Amazon Display Sakura Checker: 商品URL:', productURL);
            console.log('Amazon Display Sakura Checker: 商品ASIN:', asin);
            
            // 初期化フラグを設定
            isInitialized = true;
            
            // サクラチェック結果を取得
            checkSakuraScore(productURL, asin);
        } else if (isWishlistPage()) {
            console.log('Amazon Display Sakura Checker: ウィッシュリストページを検出');
            isInitialized = true;
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
        let shouldReinitialize = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 追加されたノードがサクラチェック結果でない場合のみ再初期化を検討
                const hasNonSakuraNodes = Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // サクラチェック結果の要素は無視
                        return !node.id?.includes('sakura-checker') && 
                               !node.className?.includes('sakura-checker') &&
                               !node.querySelector?.('#sakura-checker-result, .sakura-checker-wishlist-result');
                    }
                    return false;
                });
                
                if (hasNonSakuraNodes) {
                    shouldReinitialize = true;
                }
            }
        });
        
        // URL変更を検出（SPAナビゲーション対応）
        const currentURL = window.location.href;
        if (observer.lastURL && observer.lastURL !== currentURL) {
            console.log('Amazon Display Sakura Checker: URL変更を検出');
            isInitialized = false;
            processingASINs.clear();
            shouldReinitialize = true;
        }
        observer.lastURL = currentURL;
        
        if (shouldReinitialize && !isInitialized) {
            console.log('Amazon Display Sakura Checker: ページ変更により再初期化');
            setTimeout(() => {
                // 再初期化前にフラグをリセット
                isInitialized = false;
                initialize();
            }, 1500);
        }
    });
    
    // 初期URL記録
    observer.lastURL = window.location.href;
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();