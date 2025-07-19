// サクラチェック通信機能モジュール
// Background Scriptとの通信を管理する

// Background Scriptにサクラチェックを依頼する関数
async function checkSakuraScore(productURL, asin, processingASINs) {
    // 重複実行を防止
    if (processingASINs.has(asin)) {
        return;
    }
    
    // 既存の結果がある場合はスキップ
    const existingResult = document.querySelector('#sakura-checker-result');
    if (existingResult && !existingResult.textContent.includes('調査中') && !existingResult.textContent.includes('エラー')) {
        return;
    }
    
    processingASINs.add(asin);
    console.log('Amazon Display Sakura Checker: サクラチェック開始 - ASIN:', asin);
    
    try {
        
        // 読み込み中の表示を設定
        if (window.UiDisplay) {
            window.UiDisplay.displayLoadingResult();
        }
        
        // Chrome拡張機能のランタイムが利用可能かチェック
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
            throw new Error('Chrome拡張機能のランタイムが利用できません');
        }
        
        // Service Workerの状態確認とメッセージ送信
        console.log('Content Script: Background Service Workerにメッセージを送信中...', {
            runtimeId: chrome.runtime.id,
            productURL: productURL,
            asin: asin
        });
        
        let response;
        console.log('Content Script: Service Workerへメッセージ送信中...', {
            action: 'checkSakuraScore',
            productURL: productURL,
            asin: asin,
            timestamp: new Date().toISOString()
        });
        
        try {
            response = await Promise.race([
                chrome.runtime.sendMessage({
                    action: 'checkSakuraScore',
                    productURL: productURL,
                    asin: asin
                }),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        console.error('Content Script: タイムアウト発生 - Service Workerからの応答が45秒以内に来ませんでした');
                        reject(new Error('Background Service Workerからの応答がタイムアウトしました'));
                    }, 45000)
                )
            ]);
            
            console.log('Content Script: Background Service Workerからのレスポンス:', response);
            console.log('Content Script: レスポンス詳細:', {
                success: response?.success,
                scoreRating: response?.scoreRating,
                sakuraPercentage: response?.sakuraPercentage,
                error: response?.error,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Service Workerが停止している可能性があるため、再試行
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('Could not establish connection')) {
                console.warn('Content Script: Service Worker停止検出、再試行中...');
                
                // 短い遅延後に再試行
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                response = await chrome.runtime.sendMessage({
                    action: 'checkSakuraScore',
                    productURL: productURL,
                    asin: asin
                });
                
                console.log('Content Script: 再試行後のレスポンス:', response);
            } else {
                throw error;
            }
        }
        
        if (response?.success) {
            if (window.UiDisplay) {
                window.UiDisplay.displayDualScoreResult(response.scoreRating, response.sakuraPercentage, asin);
            }
        } else {
            if (window.UiDisplay) {
                window.UiDisplay.displayErrorResult(response?.error || 'スコアを取得できませんでした');
            }
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
        
        if (window.UiDisplay) {
            window.UiDisplay.displayErrorResult(errorMessage);
        }
    } finally {
        // 処理完了時にASINを削除
        processingASINs.delete(asin);
    }
}

// エクスポート（グローバルスコープで利用可能にする）
window.SakuraChecker = {
    checkSakuraScore
};