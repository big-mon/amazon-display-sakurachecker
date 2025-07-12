// Amazon Display Sakura Checker - Content Script (簡素版)
// 機能モジュールを統合してサクラチェック結果を表示

(function() {
    'use strict';
    
    console.log('Content Script: スクリプト読み込み開始');
    console.log('Content Script: URL:', window.location.href);
    console.log('Content Script: document.readyState:', document.readyState);
    
    // 処理中のASINを追跡して重複実行を防止
    const processingASINs = new Set();
    let isInitialized = false;
    
    // メイン処理（商品ページ専用）
    function initialize() {
        console.log('Content Script: 商品ページ初期化開始');
        
        // 重複初期化を防止
        if (isInitialized) {
            console.log('Amazon Display Sakura Checker: 既に初期化済みです');
            return;
        }
        
        // モジュールが読み込まれるまで待機
        if (!window.AsinExtractor || !window.SakuraChecker) {
            console.log('Content Script: モジュール読み込み待機中...');
            setTimeout(initialize, 100);
            return;
        }
        
        // 商品ページ判定
        if (!window.AsinExtractor.isProductPage()) {
            console.log('Amazon Display Sakura Checker: 商品ページではありません');
            return;
        }
        
        // ASIN抽出
        const asin = window.AsinExtractor.extractProductASIN();
        if (!asin) {
            console.log('Amazon Display Sakura Checker: 商品ASINを取得できませんでした');
            return;
        }
        
        console.log('Amazon Display Sakura Checker: 商品ASIN:', asin);
        
        // 初期化フラグを設定
        isInitialized = true;
        
        // サクラチェック実行
        const productURL = window.AsinExtractor.generateProductURL(asin);
        window.SakuraChecker.checkSakuraScore(productURL, asin, processingASINs);
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