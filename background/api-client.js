// API通信機能モジュール
// sakura-checker.jpとの通信とリクエスト制御を管理

// リクエスト間隔制御のための変数
let lastRequestTime = 0;
const minRequestInterval = 2000; // 最小2秒間隔

// サクラチェッカーからサクラ度を取得する関数
async function checkSakuraScore(productURL, asin) {
    const timeoutMs = 20000; // 20秒タイムアウト
    const maxRetries = 3; // 最大3回リトライ
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Background Service Worker: サクラチェック開始 (${attempt + 1}/${maxRetries + 1}) - ASIN:`, asin);
            console.log(`Background Service Worker: Service Worker状態:`, {
                scriptURL: self.location ? self.location.href : 'unknown',
                origin: self.origin || 'unknown',
                currentTime: new Date().toISOString(),
                fetchAvailable: typeof fetch !== 'undefined'
            });
            
            // リクエスト間隔制御
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                console.log(`Background Service Worker: リクエスト間隔調整のため${waitTime}ms待機`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // ランダムな追加遅延（1-3秒）でより自然なアクセスパターンを模倣
            const randomDelay = Math.floor(Math.random() * 2000) + 1000;
            console.log(`Background Service Worker: ランダム遅延 ${randomDelay}ms 実行中`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
            lastRequestTime = Date.now();
            
            // sakura-checker.jpのURL構築（正しい形式：ASIN + スラッシュ）
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${asin}/`;
            
            console.log('Background Service Worker: 商品URL:', productURL);
            console.log('Background Service Worker: ASIN:', asin);
            console.log('Background Service Worker: リクエストURL:', sakuraCheckerURL);
            console.log('Background Service Worker: fetchリクエスト開始:', {
                method: 'GET',
                timeout: timeoutMs,
                timestamp: new Date().toISOString()
            });
            
            // タイムアウト制御
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(sakuraCheckerURL, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br', // 通常のブラウザ動作に合わせる
                    'Cache-Control': 'max-age=0',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': productURL  // リファラーを商品URLに設定
                }
            });
            
            clearTimeout(timeoutId);
            
            console.log('Background Service Worker: fetchレスポンス受信:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries()),
                type: response.type,
                redirected: response.redirected
            });
            
            if (!response.ok) {
                const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
                console.log('Background Service Worker: HTTPエラー詳細:', {
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
            
            // レスポンス文字エンコーディングの確認
            const contentType = response.headers.get('content-type') || '';
            const contentEncoding = response.headers.get('content-encoding') || '';
            console.log('Background Script: レスポンスヘッダー情報:', {
                contentType: contentType,
                contentEncoding: contentEncoding,
                charset: contentType.includes('charset=') ? contentType.split('charset=')[1] : 'なし'
            });
            
            const html = await response.text();
            console.log('Background Script: レスポンス受信完了', {
                url: sakuraCheckerURL,
                responseLength: html.length,
                firstChars: html.substring(0, 100),
                containsJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(html),
                containsHTML: html.includes('<html') || html.includes('<HTML'),
                containsBody: html.includes('<body') || html.includes('<BODY')
            });
            
            // レスポンスサイズチェック
            if (html.length < 100) {
                throw new Error('レスポンスが短すぎます（不正なレスポンス）');
            }
            
            // 文字化けチェック
            const isGarbled = !html.includes('<html') && !html.includes('<HTML') && 
                             !html.includes('<body') && !html.includes('<BODY') &&
                             !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(html);
            
            if (isGarbled) {
                console.log('Background Script: ⚠️ HTMLレスポンスが文字化けしている可能性があります');
                console.log('Background Script: 文字化け検証情報:', {
                    hasHTMLTag: html.includes('<html') || html.includes('<HTML'),
                    hasBodyTag: html.includes('<body') || html.includes('<BODY'),
                    hasJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(html),
                    firstByte: html.charCodeAt(0),
                    secondByte: html.charCodeAt(1),
                    thirdByte: html.charCodeAt(2)
                });
                
                // 文字化けしている場合でも処理を続行（デバッグのため）
                console.log('Background Script: 文字化けしたレスポンスでもスコア解析を試行します');
            }
            
            // HTMLから2種類のスコアを抽出
            console.log('Background Script: HTMLレスポンス受信完了、スコア解析開始');
            
            // 99%と1.24の存在チェック
            const contains99 = html.includes('99%') || html.includes('99 %');
            const contains124 = html.includes('1.24') || html.includes('1,24');
            console.log('Background Script: 期待値存在チェック:', {
                contains99Percent: contains99,
                contains124Rating: contains124
            });
            
            if (contains99) {
                const match99 = html.match(/.{0,100}99\s*%.{0,100}/);
                if (match99) {
                    console.log('Background Script: 99%周辺HTML:', match99[0]);
                }
            }
            
            if (contains124) {
                const match124 = html.match(/.{0,100}1\.24.{0,100}/);
                if (match124) {
                    console.log('Background Script: 1.24周辺HTML:', match124[0]);
                }
            }
            
            // Chrome拡張機能でのHTMLレスポンス詳細デバッグ
            console.log('Background Script: Chrome拡張機能でのHTML解析詳細デバッグ開始');
            console.log('Background Script: HTMLレスポンスの構造解析:');
            console.log('Background Script: - HTML長さ:', html.length);
            console.log('Background Script: - 最初の1000文字:', html.substring(0, 1000));
            console.log('Background Script: - 中間1000文字:', html.substring(Math.floor(html.length/2), Math.floor(html.length/2) + 1000));
            console.log('Background Script: - 最後の1000文字:', html.substring(html.length - 1000));
            
            // サクラチェッカー特有のセクション要素を探す
            const sections = html.match(/<section[^>]*>/gi) || [];
            console.log('Background Script: - section要素数:', sections.length);
            
            // item-ratingクラスを含む要素を検索
            const itemRatingMatches = html.match(/<[^>]*class=[^>]*item-rating[^>]*>/gi) || [];
            console.log('Background Script: - item-rating要素数:', itemRatingMatches.length);
            
            // サクラ度を含むsection要素を検索
            const sakuraSections = html.match(/<section[^>]*>[\s\S]*?サクラ度[\s\S]*?<\/section>/gi) || [];
            console.log('Background Script: - サクラ度section数:', sakuraSections.length);
            
            const scoreRating = self.ScoreParser ? self.ScoreParser.parseScoreRating(html) : null;
            const sakuraPercentage = self.ScoreParser ? self.ScoreParser.parseSakuraPercentage(html) : null;
            
            console.log('Background Script: スコア解析結果:', {
                scoreRating: scoreRating,
                scoreRatingType: typeof scoreRating,
                scoreRatingDetails: scoreRating,
                sakuraPercentage: sakuraPercentage,
                sakuraPercentageType: typeof sakuraPercentage
            });
            
            // scoreRatingが画像オブジェクトかどうか詳細チェック
            if (scoreRating && typeof scoreRating === 'object') {
                console.log('Background Script: scoreRatingオブジェクト詳細:', {
                    hasType: 'type' in scoreRating,
                    type: scoreRating.type,
                    hasImageData: 'imageData' in scoreRating,
                    hasSuffix: 'suffix' in scoreRating,
                    imageDataLength: scoreRating.imageData ? scoreRating.imageData.length : 0
                });
            }
            
            if (scoreRating !== null || sakuraPercentage !== null) {
                console.log('Background Script: 少なくとも1つのスコアが取得できました');
                return { 
                    success: true, 
                    scoreRating: scoreRating,
                    sakuraPercentage: sakuraPercentage,
                    asin: asin,
                    timestamp: new Date().toISOString()
                };
            } else {
                // 両方のスコアが見つからない場合、詳細なデバッグ情報を追加
                console.log('Background Script: 全てのスコアの抽出に失敗 - 詳細デバッグ開始');
                
                // 基本HTML情報
                const basicInfo = {
                    htmlLength: html.length,
                    containsSakura: html.includes('サクラ'),
                    containsPercent: html.includes('%'),
                    containsNumber: /\d/.test(html),
                    containsImage: html.includes('<img'),
                    imageMatches: html.match(/rv_level_s\d+\.png/g) || [],
                    sPrefixImages: html.match(/s\d+\.png/g) || [],
                    percentImages: html.match(/percent|%/gi) || []
                };
                console.log('Background Script: 基本HTML情報:', basicInfo);
                
                // より詳細なHTMLコンテンツ解析
                const titleMatch = html.match(/<title[^>]*>([^<]*)</i);
                const h1Match = html.match(/<h1[^>]*>([^<]*)</i);
                console.log('Background Script: ページタイトル:', titleMatch ? titleMatch[1] : 'なし');
                console.log('Background Script: H1要素:', h1Match ? h1Match[1] : 'なし');
                
                // HTML構造の詳細分析
                const structureInfo = {
                    pagetopElements: html.match(/id=["']pagetop["']/gi) || [],
                    sectionElements: html.match(/<section[^>]*>/gi) || [],
                    divElements: html.match(/<div[^>]*>/gi) || [],
                    spanElements: html.match(/<span[^>]*>/gi) || [],
                    pElements: html.match(/<p[^>]*>/gi) || [],
                    imgElements: html.match(/<img[^>]*>/gi) || []
                };
                console.log('Background Script: HTML構造詳細:', {
                    pagetopCount: structureInfo.pagetopElements.length,
                    sectionCount: structureInfo.sectionElements.length,
                    divCount: structureInfo.divElements.length,
                    spanCount: structureInfo.spanElements.length,
                    pCount: structureInfo.pElements.length,
                    imgCount: structureInfo.imgElements.length
                });
                
                // 画像ファイル名の詳細分析
                const imageDetails = html.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
                if (imageDetails && imageDetails.length > 0) {
                    console.log('Background Script: 画像要素数:', imageDetails.length);
                    const imageSources = imageDetails.map(img => {
                        const srcMatch = img.match(/src="([^"]*)"/);
                        return srcMatch ? srcMatch[1] : null;
                    }).filter(src => src !== null);
                    
                    console.log('Background Script: 画像ソース（最初の10個）:', imageSources.slice(0, 10));
                    
                    // サクラチェッカー特有の画像パターンをチェック
                    const sakuraImages = imageSources.filter(src => 
                        src.includes('rv_level_s') || 
                        src.includes('/s') || 
                        src.includes('percent') ||
                        /s\d+\.png/.test(src)
                    );
                    console.log('Background Script: サクラチェッカー画像パターン:', sakuraImages);
                } else {
                    console.log('Background Script: 画像要素が見つかりません');
                }
                
                // section[4]やdiv[3]、div[4]などの特定要素をチェック
                const specificElements = {
                    section4: html.match(/<section[^>]*>[\s\S]*?<\/section>/gi),
                    divWithClass: html.match(/<div[^>]*class="[^"]*"[^>]*>/gi) || [],
                    spanWithContent: html.match(/<span[^>]*>[^<]*<\/span>/gi) || []
                };
                console.log('Background Script: 特定要素解析:', {
                    section4Count: specificElements.section4 ? specificElements.section4.length : 0,
                    divWithClassCount: specificElements.divWithClass.length,
                    spanWithContentCount: specificElements.spanWithContent.length
                });
                
                // HTMLサンプルを複数箇所から取得
                const htmlSamples = {
                    beginning: html.substring(0, 500),
                    middle: html.substring(Math.floor(html.length / 2), Math.floor(html.length / 2) + 500),
                    end: html.substring(html.length - 500)
                };
                console.log('Background Script: HTMLサンプル（開始500文字）:', htmlSamples.beginning);
                console.log('Background Script: HTMLサンプル（中間500文字）:', htmlSamples.middle);
                console.log('Background Script: HTMLサンプル（終了500文字）:', htmlSamples.end);
                
                return { 
                    success: false, 
                    error: 'スコアを取得できませんでした。商品が見つからないか、サクラチェッカーでの解析が完了していない可能性があります。', 
                    asin: asin,
                    debugInfo: {
                        htmlLength: html.length,
                        hasImages: html.includes('<img'),
                        hasPercent: html.includes('%'),
                        hasSakura: html.includes('サクラ'),
                        title: titleMatch ? titleMatch[1] : null
                    }
                };
            }
            
        } catch (error) {
            console.error(`Background Service Worker: エラー (試行 ${attempt + 1}):`, {
                name: error.name,
                message: error.message,
                stack: error.stack,
                attempt: attempt + 1,
                maxRetries: maxRetries + 1
            });
            
            // 最後の試行でない場合はリトライ
            if (attempt < maxRetries) {
                const isNetworkError = error.name === 'AbortError' || error.name === 'TypeError';
                const isServiceWorkerError = error.message.includes('Service Worker') || 
                                           error.message.includes('context invalidated') ||
                                           error.message.includes('terminated');
                
                if (isNetworkError || isServiceWorkerError) {
                    const retryDelay = 1000 * (attempt + 1); // 指数バックオフ
                    console.log(`Background Service Worker: ${isServiceWorkerError ? 'Service Worker' : 'ネットワーク'}エラー、${retryDelay}ms後にリトライします...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
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

// エクスポート（Service Worker環境では self を使用）
self.ApiClient = {
    checkSakuraScore
};