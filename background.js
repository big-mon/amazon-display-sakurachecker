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
            
            // HTMLから2種類のスコアを抽出
            console.log('Background Script: HTMLレスポンスの一部（デバッグ用）:', html.substring(0, 2000));
            
            const scoreRating = parseScoreRating(html);
            const sakuraPercentage = parseSakuraPercentage(html);
            
            console.log('Background Script: スコア解析結果:', {
                scoreRating: scoreRating,
                sakuraPercentage: sakuraPercentage
            });
            
            if (scoreRating !== null || sakuraPercentage !== null) {
                return { 
                    success: true, 
                    scoreRating: scoreRating,
                    sakuraPercentage: sakuraPercentage,
                    asin: asin,
                    timestamp: new Date().toISOString()
                };
            } else {
                // 両方のスコアが見つからない場合、デバッグ情報を追加
                console.log('Background Script: 全てのスコアの抽出に失敗');
                console.log('Background Script: HTMLの詳細分析:', {
                    htmlLength: html.length,
                    containsSakura: html.includes('サクラ'),
                    containsPercent: html.includes('%'),
                    imageMatches: html.match(/rv_level_s\d+\.png/g) || [],
                    htmlSample: html.substring(0, 1000)
                });
                return { 
                    success: false, 
                    error: 'スコアを取得できませんでした。商品が見つからないか、サクラチェッカーでの解析が完了していない可能性があります。', 
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

// n/5 形式のスコア解析関数
function parseScoreRating(html) {
    try {
        console.log('Background Script: n/5スコア解析開始');
        
        // XPath指定位置の要素を模擬検索とデバッグ
        // //*[@id="pagetop"]/div/div/div[1]/section[4]/div[3]/div[11]/div/div[1]/p[2]/span
        console.log('Background Script: n/5スコア用XPath領域を検索中...');
        
        // より柔軟なパターンで検索
        const xpathPatterns = [
            /id="pagetop"[\s\S]*?section[\s\S]*?div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi,
            /section[\s\S]*?div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi,
            /div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi
        ];
        
        let targetArea = null;
        for (let i = 0; i < xpathPatterns.length; i++) {
            const matches = html.match(xpathPatterns[i]);
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                console.log(`Background Script: n/5スコアエリア発見 (パターン${i+1}):`, targetArea.substring(0, 800));
                
                // この領域内の全ての画像src属性を抽出
                const imgSrcs = targetArea.match(/src="[^"]*"/gi);
                if (imgSrcs) {
                    console.log('Background Script: n/5エリア内の画像:', imgSrcs);
                }
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: n/5スコアエリアが見つかりませんでした');
        }
        
        // n/5形式のスコア画像パターンを検索
        const scoreImagePatterns = [
            // 数字画像の連続パターン（例: 1.24/5 = 1_dot_2_4_slash_5.png のような形式）
            /(\d+)\.(\d+)\/5/gi,
            /(\d)_(\d+)_slash_5\.png/gi,
            /score_(\d+)_(\d+)_5\.png/gi,
            /rating_(\d)_(\d+)\.png/gi
        ];
        
        for (const pattern of scoreImagePatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const scoreText = match[0];
                console.log(`Background Script: n/5スコアパターンマッチ "${pattern}" -> ${scoreText}`);
                
                // スコア形式の文字列をそのまま返す
                if (scoreText.includes('/5')) {
                    return scoreText;
                }
            }
        }
        
        // 画像ファイル名から数字を復元する試行
        const digitImagePattern = /(\d+)_(\d+)_(\d+)_(\d+)_(\d+)\.png/gi;
        const digitMatches = html.matchAll(digitImagePattern);
        for (const match of digitMatches) {
            const digits = match.slice(1).join('.');
            if (digits.includes('.') && digits.includes('5')) {
                console.log(`Background Script: 数字画像復元 -> ${digits}`);
                return digits;
            }
        }
        
        console.log('Background Script: n/5スコアを検出できませんでした');
        return null;
    } catch (error) {
        console.error('Background Script: n/5スコア解析エラー:', error);
        return null;
    }
}

// n% 形式のサクラ度解析関数
function parseSakuraPercentage(html) {
    try {
        console.log('Background Script: n%サクラ度解析開始');
        
        // XPath指定位置の要素を模擬検索とデバッグ
        // //*[@id="pagetop"]/div/div/div[1]/section[4]/div[4]/div/p[1]/span
        console.log('Background Script: n%サクラ度用XPath領域を検索中...');
        
        // より柔軟なパターンで検索
        const xpathPatterns = [
            /id="pagetop"[\s\S]*?section[\s\S]*?div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi,
            /section[\s\S]*?div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi,
            /div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi
        ];
        
        let targetArea = null;
        for (let i = 0; i < xpathPatterns.length; i++) {
            const matches = html.match(xpathPatterns[i]);
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                console.log(`Background Script: n%サクラ度エリア発見 (パターン${i+1}):`, targetArea.substring(0, 800));
                
                // この領域内の全ての画像src属性を抽出
                const imgSrcs = targetArea.match(/src="[^"]*"/gi);
                if (imgSrcs) {
                    console.log('Background Script: n%エリア内の画像:', imgSrcs);
                }
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: n%サクラ度エリアが見つかりませんでした');
        }
        
        // 全HTML内の全ての画像src属性を解析
        const allImgSrcs = html.match(/src="[^"]*"/gi) || [];
        console.log('Background Script: 全HTML内の画像数:', allImgSrcs.length);
        
        // 数字を含む画像を特定
        const digitImages = allImgSrcs.filter(src => /\d/.test(src));
        console.log('Background Script: 数字を含む画像:', digitImages);
        
        // パーセント形式の画像パターンを検索
        const percentageImagePatterns = [
            /(\d+)%/gi,
            /(\d+)_percent\.png/gi,
            /sakura_(\d+)_percent\.png/gi,
            /danger_(\d+)\.png/gi,
            /(\d+)_(\d+)_percent\.png/gi,  // 2桁の数字の場合
            /(\d+)\.png/gi,  // 単純な数字画像
            /img_(\d+)\.png/gi,  // img_数字形式
            /num_(\d+)\.png/gi   // num_数字形式
        ];
        
        for (const pattern of percentageImagePatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const score = parseInt(match[1]);
                console.log(`Background Script: n%パターンマッチ "${pattern}" -> ${score}%`);
                if (!isNaN(score) && score >= 0 && score <= 100) {
                    return score;
                }
            }
        }
        
        // 2桁の数字を復元（例: 99% = 9_9_percent.png）
        const twoDigitPattern = /(\d)(\d)_percent\.png/gi;
        const twoDigitMatches = html.matchAll(twoDigitPattern);
        for (const match of twoDigitMatches) {
            const score = parseInt(match[1] + match[2]);
            console.log(`Background Script: 2桁復元 -> ${score}%`);
            if (!isNaN(score) && score >= 0 && score <= 100) {
                return score;
            }
        }
        
        // 画像alt属性からの抽出
        const altPattern = /alt="(\d+)%"/gi;
        const altMatches = html.matchAll(altPattern);
        for (const match of altMatches) {
            const score = parseInt(match[1]);
            console.log(`Background Script: alt属性から -> ${score}%`);
            if (!isNaN(score) && score >= 0 && score <= 100) {
                return score;
            }
        }
        
        console.log('Background Script: n%サクラ度を検出できませんでした');
        return null;
    } catch (error) {
        console.error('Background Script: n%サクラ度解析エラー:', error);
        return null;
    }
}