// Amazon Display Sakura Checker - Background Script
// サクラチェッカーAPIとの通信を担当

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkSakuraScore') {
        checkSakuraScore(request.productURL, request.asin)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        
        // 非同期レスポンスを有効化
        return true;
    }
});

// サクラチェッカーからサクラ度を取得する関数
async function checkSakuraScore(productURL, asin) {
    const timeoutMs = 15000; // 15秒タイムアウト
    const maxRetries = 2; // 最大2回リトライ
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Background Script: サクラチェック開始 (${attempt + 1}/${maxRetries + 1}) - ASIN:`, asin);
            
            // sakura-checker.jpのURL構築
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${encodeURIComponent(productURL)}`;
            
            // タイムアウト制御
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(sakuraCheckerURL, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
                
                // サーバーエラーの場合はリトライ
                if (response.status >= 500 && attempt < maxRetries) {
                    console.log('Background Script: サーバーエラー、リトライします...');
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 指数バックオフ
                    continue;
                }
                
                throw new Error(errorMessage);
            }
            
            const html = await response.text();
            console.log('Background Script: レスポンス受信完了');
            
            // レスポンスサイズチェック
            if (html.length < 100) {
                throw new Error('レスポンスが短すぎます（不正なレスポンス）');
            }
            
            // HTMLからサクラ度を抽出
            const sakuraScore = parseSakuraScore(html);
            
            if (sakuraScore !== null) {
                console.log('Background Script: サクラ度取得成功:', sakuraScore);
                return { 
                    success: true, 
                    sakuraScore: sakuraScore, 
                    asin: asin,
                    timestamp: new Date().toISOString()
                };
            } else {
                // サクラ度が見つからない場合、リトライしない
                console.log('Background Script: サクラ度の抽出に失敗');
                return { 
                    success: false, 
                    error: 'サクラ度を取得できませんでした。商品が見つからないか、サクラチェッカーでの解析が完了していない可能性があります。', 
                    asin: asin 
                };
            }
            
        } catch (error) {
            console.error(`Background Script: エラー (試行 ${attempt + 1}):`, error);
            
            // 最後の試行でない場合はリトライ
            if (attempt < maxRetries) {
                const isNetworkError = error.name === 'AbortError' || error.name === 'TypeError';
                if (isNetworkError) {
                    console.log('Background Script: ネットワークエラー、リトライします...');
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 指数バックオフ
                    continue;
                }
            }
            
            // エラーメッセージを分かりやすく変換
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'リクエストがタイムアウトしました。ネットワーク接続を確認してください。';
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
            } else if (error.message.includes('HTTP Error: 404')) {
                errorMessage = '商品が見つかりません。ASINが正しいか確認してください。';
            } else if (error.message.includes('HTTP Error: 429')) {
                errorMessage = 'アクセス制限により一時的に利用できません。しばらく待ってから再試行してください。';
            } else if (error.message.includes('HTTP Error: 5')) {
                errorMessage = 'サクラチェッカーのサーバーエラーです。しばらく待ってから再試行してください。';
            }
            
            return { 
                success: false, 
                error: errorMessage, 
                asin: asin,
                retries: attempt + 1
            };
        }
    }
}

// HTMLからサクラ度を解析する関数
function parseSakuraScore(html) {
    try {
        // 複数のパターンでサクラ度を検索
        const patterns = [
            /サクラ度[：:\s]*(\d+)%/,
            /(\d+)%.*サクラ/,
            /サクラチェック結果[：:\s]*(\d+)%/,
            /危険度[：:\s]*(\d+)%/,
            /信頼度[：:\s]*(\d+)%/
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                const score = parseInt(match[1]);
                if (!isNaN(score) && score >= 0 && score <= 100) {
                    return score;
                }
            }
        }
        
        // 画像ファイル名からのパターン抽出
        const imagePattern = /(\d+)\.png|(\d+)\.jpg|(\d+)\.gif/g;
        const imageMatches = html.match(imagePattern);
        if (imageMatches) {
            for (const imageMatch of imageMatches) {
                const scoreMatch = imageMatch.match(/(\d+)\./);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1]);
                    if (!isNaN(score) && score >= 0 && score <= 100) {
                        return score;
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Background Script: HTML解析エラー:', error);
        return null;
    }
}