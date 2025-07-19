// Amazon Display Sakura Checker - Background Service Worker
// 機能モジュールを統合してサクラチェッカーAPIとの通信を担当

// Service Worker として動作するため、importScripts を使用
importScripts(
    'background/score-parser.js',
    'background/api-client.js'
);

console.log('Background Service Worker: スクリプト読み込み完了');

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background Service Worker: メッセージ受信:', request);
    
    if (request.action === 'checkSakuraScore') {
        console.log('Background Service Worker: サクラチェック要求受信:', {
            productURL: request.productURL,
            asin: request.asin
        });
        
        // モジュールが読み込まれていることを確認
        if (!self.ApiClient) {
            console.error('Background Service Worker: ApiClientモジュールが読み込まれていません');
            sendResponse({ 
                success: false, 
                error: 'API通信モジュールが利用できません' 
            });
            return;
        }
        
        self.ApiClient.checkSakuraScore(request.productURL, request.asin)
            .then(result => {
                console.log('Background Service Worker: 処理完了:', result?.success ? 'success' : 'failed');
                sendResponse(result);
            })
            .catch(error => {
                console.error('Background Service Worker: 処理エラー:', error);
                console.error('Background Service Worker: エラースタック:', error.stack);
                
                const errorResponse = { 
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
                
                try {
                    sendResponse(errorResponse);
                    console.log('Background Service Worker: エラーレスポンス送信完了');
                } catch (sendError) {
                    console.error('Background Service Worker: エラーレスポンス送信失敗:', sendError);
                }
            });
        
        // 非同期レスポンスを有効化
        return true;
    }
    
    console.log('Background Service Worker: 不明なアクション:', request.action);
});

// Service Worker のインストールとアクティベーション
self.addEventListener('install', event => {
    console.log('Background Service Worker: インストール完了');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Background Service Worker: アクティベーション完了');
    event.waitUntil(self.clients.claim());
});