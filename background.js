// Amazon Display Sakura Checker - Background Script (簡素版)
// 機能モジュールを統合してサクラチェッカーAPIとの通信を担当

console.log('Background Script: スクリプト読み込み完了');

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background Script: メッセージ受信:', request);
    
    if (request.action === 'checkSakuraScore') {
        console.log('Background Script: サクラチェック要求受信:', {
            productURL: request.productURL,
            asin: request.asin
        });
        
        // モジュールが読み込まれていることを確認
        if (!window.ApiClient) {
            console.error('Background Script: ApiClientモジュールが読み込まれていません');
            sendResponse({ 
                success: false, 
                error: 'API通信モジュールが利用できません' 
            });
            return;
        }
        
        window.ApiClient.checkSakuraScore(request.productURL, request.asin)
            .then(result => {
                console.log('Background Script: 処理完了:', result?.success ? 'success' : 'failed');
                sendResponse(result);
            })
            .catch(error => {
                console.error('Background Script: 処理エラー:', error);
                console.error('Background Script: エラースタック:', error.stack);
                
                const errorResponse = { 
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
                
                try {
                    sendResponse(errorResponse);
                    console.log('Background Script: エラーレスポンス送信完了');
                } catch (sendError) {
                    console.error('Background Script: エラーレスポンス送信失敗:', sendError);
                }
            });
        
        // 非同期レスポンスを有効化
        return true;
    }
    
    console.log('Background Script: 不明なアクション:', request.action);
});