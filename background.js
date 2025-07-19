// Amazon Display Sakura Checker - Background Service Worker
// 機能モジュールを統合してサクラチェッカーAPIとの通信を担当

console.log('Background Service Worker: 開始');

// Service Worker として動作するため、importScripts を使用
try {
    importScripts(
        'background/score-parser.js',
        'background/api-client.js'
    );
    console.log('Background Service Worker: スクリプト読み込み完了');
} catch (error) {
    console.error('Background Service Worker: スクリプト読み込みエラー:', error);
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background Service Worker: メッセージ受信:', request);
    
    if (request.action === 'checkSakuraScore') {
        console.log('Background Service Worker: サクラチェック要求受信:', {
            productURL: request.productURL,
            asin: request.asin,
            timestamp: new Date().toISOString()
        });
        
        console.log('Background Service Worker: Service Worker状態:', {
            apiClientLoaded: !!self.ApiClient,
            scoreParserLoaded: !!self.ScoreParser,
            runtimeAvailable: !!chrome.runtime,
            fetchAvailable: !!fetch
        });
        
        // モジュールが読み込まれていることを確認
        if (!self.ApiClient) {
            console.error('Background Service Worker: ApiClientモジュールが読み込まれていません');
            const errorResponse = { 
                success: false, 
                error: 'API通信モジュールが利用できません',
                timestamp: new Date().toISOString()
            };
            console.log('Background Service Worker: エラーレスポンス送信:', errorResponse);
            sendResponse(errorResponse);
            return;
        }
        
        console.log('Background Service Worker: ApiClient.checkSakuraScore呼び出し開始');
        
        // タイムアウト処理付きでAPIを呼び出し
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                console.error('Background Service Worker: API呼び出しタイムアウト（30秒）');
                reject(new Error('サクラチェッカーAPIの応答がタイムアウトしました（30秒）'));
            }, 30000);
        });
        
        Promise.race([
            self.ApiClient.checkSakuraScore(request.productURL, request.asin),
            timeoutPromise
        ])
            .then(result => {
                console.log('Background Service Worker: 処理完了:', result?.success ? 'success' : 'failed');
                console.log('Background Service Worker: 結果詳細:', {
                    success: result?.success,
                    scoreRating: result?.scoreRating,
                    sakuraPercentage: result?.sakuraPercentage,
                    error: result?.error,
                    timestamp: new Date().toISOString()
                });
                
                try {
                    sendResponse(result);
                    console.log('Background Service Worker: レスポンス送信完了');
                } catch (sendError) {
                    console.error('Background Service Worker: レスポンス送信失敗:', sendError);
                }
            })
            .catch(error => {
                console.error('Background Service Worker: 処理エラー:', error);
                console.error('Background Service Worker: エラースタック:', error.stack);
                
                const errorResponse = { 
                    success: false,
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
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
    
    // デバッグ用のpingアクション
    if (request.action === 'ping') {
        console.log('Background Service Worker: pingメッセージ受信');
        sendResponse({ 
            pong: true, 
            timestamp: new Date().toISOString(),
            modules: {
                apiClient: !!self.ApiClient,
                scoreParser: !!self.ScoreParser
            }
        });
        return;
    }
    
    // デバッグ用のstatusアクション
    if (request.action === 'status') {
        console.log('Background Service Worker: statusメッセージ受信');
        sendResponse({ 
            status: 'active',
            timestamp: new Date().toISOString(),
            modules: {
                apiClient: !!self.ApiClient,
                scoreParser: !!self.ScoreParser,
                fetch: !!fetch,
                chrome: !!chrome
            }
        });
        return;
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