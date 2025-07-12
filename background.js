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

// リクエスト間隔制御のための変数
let lastRequestTime = 0;
const minRequestInterval = 2000; // 最小2秒間隔

// サクラチェッカーからサクラ度を取得する関数
async function checkSakuraScore(productURL, asin) {
    const timeoutMs = 20000; // 20秒タイムアウト
    const maxRetries = 3; // 最大3回リトライ
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Background Script: サクラチェック開始 (${attempt + 1}/${maxRetries + 1}) - ASIN:`, asin);
            
            // リクエスト間隔制御
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                console.log(`Background Script: リクエスト間隔調整のため${waitTime}ms待機`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // ランダムな追加遅延（1-3秒）でより自然なアクセスパターンを模倣
            const randomDelay = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
            lastRequestTime = Date.now();
            
            // sakura-checker.jpのURL構築（正しい形式：ASIN + スラッシュ）
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${asin}/`;
            
            console.log('Background Script: 商品URL:', productURL);
            console.log('Background Script: ASIN:', asin);
            console.log('Background Script: リクエストURL:', sakuraCheckerURL);
            
            // タイムアウト制御
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(sakuraCheckerURL, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'max-age=0',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.google.com/'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
                console.log('Background Script: HTTPエラー詳細:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: sakuraCheckerURL,
                    headers: Object.fromEntries(response.headers.entries())
                });
                
                // 403エラーの場合は特別な処理
                if (response.status === 403) {
                    console.log('Background Script: 403エラー - Bot検出またはアクセス制限');
                    
                    // 403エラーの場合、より長い遅延でリトライ
                    if (attempt < maxRetries) {
                        const retryDelay = Math.floor(Math.random() * 5000) + 5000;
                        console.log(`Background Script: 403エラーによりリトライ - ${retryDelay}ms後に再試行`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                }
                
                // サーバーエラーの場合はリトライ
                if (response.status >= 500 && attempt < maxRetries) {
                    console.log('Background Script: サーバーエラー、リトライします...');
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                
                throw new Error(errorMessage);
            }
            
            const html = await response.text();
            console.log('Background Script: レスポンス受信完了', {
                url: sakuraCheckerURL,
                responseLength: html.length
            });
            
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
            } else if (error.message.includes('HTTP Error: 400')) {
                errorMessage = 'リクエストが不正です。商品URLの形式に問題がある可能性があります。';
            } else if (error.message.includes('HTTP Error: 403')) {
                errorMessage = 'アクセスが制限されています。サクラチェッカーがBot検出を行っている可能性があります。しばらく時間をおいてから再試行してください。';
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