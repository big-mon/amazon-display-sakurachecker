// スコア解析機能モジュール
// sakura-checker.jpから画像を直接抽出

// 99%周辺から実際のスコア画像を抽出
function extractScoreFromImages(html) {
    try {
        console.log('Background Script: 99%周辺からスコア画像抽出開始');
        
        // 99%周辺のHTMLを詳しく解析
        const ninetyNineMatches = html.match(/.{0,2000}99\s*%.{0,2000}/gi);
        
        if (ninetyNineMatches && ninetyNineMatches.length > 0) {
            console.log('Background Script: 99%周辺HTML詳細解析開始');
            
            for (let i = 0; i < ninetyNineMatches.length; i++) {
                const section = ninetyNineMatches[i];
                console.log(`Background Script: 99%セクション ${i + 1}:`, section.substring(0, 500));
                
                // このセクション内の画像を抽出
                const imgMatches = section.match(/<img[^>]*src="[^"]*"[^>]*>/gi) || [];
                console.log(`Background Script: セクション ${i + 1} 内の画像数:`, imgMatches.length);
                
                if (imgMatches.length > 0) {
                    imgMatches.forEach((imgTag, imgIndex) => {
                        const srcMatch = imgTag.match(/src="([^"]*)"/);
                        if (srcMatch) {
                            console.log(`Background Script: セクション ${i + 1} 画像 ${imgIndex + 1}:`, srcMatch[1]);
                        }
                    });
                }
            }
        }
        
        // サクラ度と評価に特化したセクションを探す
        const sakuraSection = html.match(/サクラ度.{0,1000}(?:危険|安全|注意)/gi);
        const ratingSection = html.match(/評価.{0,1000}(?:星|\/5)/gi);
        
        console.log('Background Script: サクラ度セクション:', sakuraSection ? sakuraSection.length : 0);
        console.log('Background Script: 評価セクション:', ratingSection ? ratingSection.length : 0);
        
        // より具体的なパターンで実際のスコア画像を検索
        let sakuraImages = [];
        let scoreImages = [];
        
        // 99%を含むセクションから連続する画像を抽出
        if (ninetyNineMatches && ninetyNineMatches.length > 0) {
            const mainSection = ninetyNineMatches[0];
            
            // 99%の前後で数字画像を探す
            const beforeNinetyNine = mainSection.split('99%')[0];
            const afterNinetyNine = mainSection.split('99%')[1];
            
            // 99%前の画像（サクラ度）
            const sakuraImgMatches = beforeNinetyNine.match(/<img[^>]*src="[^"]*rv_level_s[^"]*"[^>]*>/gi) || [];
            // 99%後の画像（評価）
            const scoreImgMatches = afterNinetyNine.match(/<img[^>]*src="[^"]*rv_level_s[^"]*"[^>]*>/gi) || [];
            
            console.log('Background Script: 99%前の画像数:', sakuraImgMatches.length);
            console.log('Background Script: 99%後の画像数:', scoreImgMatches.length);
            
            // 画像を処理
            sakuraImages = sakuraImgMatches.map(imgTag => {
                const srcMatch = imgTag.match(/src="([^"]*)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    return {
                        src: src,
                        alt: '',
                        fullUrl: src.startsWith('/') ? 'https://sakura-checker.jp' + src : src
                    };
                }
                return null;
            }).filter(img => img !== null);
            
            scoreImages = scoreImgMatches.map(imgTag => {
                const srcMatch = imgTag.match(/src="([^"]*)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    return {
                        src: src,
                        alt: '',
                        fullUrl: src.startsWith('/') ? 'https://sakura-checker.jp' + src : src
                    };
                }
                return null;
            }).filter(img => img !== null);
        }
        
        console.log('Background Script: 抽出されたサクラ度画像:', sakuraImages.map(img => img.src));
        console.log('Background Script: 抽出された評価画像:', scoreImages.map(img => img.src));
        
        return {
            sakuraImages: sakuraImages,
            scoreImages: scoreImages
        };
        
    } catch (error) {
        console.error('Background Script: 画像抽出エラー:', error);
        return { sakuraImages: [], scoreImages: [] };
    }
}

// 複数の画像を組み合わせて表示用のHTMLを作成
function createImageDisplayHTML(images, suffix) {
    if (!images || images.length === 0) {
        return null;
    }
    
    const imageElements = images.map(img => 
        `<img src="${img.fullUrl}" style="display: inline-block; height: 16px; vertical-align: middle; margin: 0 1px;">`
    ).join('');
    
    return {
        type: 'html',
        htmlContent: imageElements + suffix,
        suffix: suffix
    };
}

// n/5 形式のスコア解析関数（簡素化版）
function parseScoreRating(html) {
    try {
        console.log('Background Script: n/5スコア解析開始');
        
        const imageData = extractScoreFromImages(html);
        
        if (imageData.scoreImages && imageData.scoreImages.length > 0) {
            console.log('Background Script: スコア画像を返します');
            return createImageDisplayHTML(imageData.scoreImages, '/5');
        }
        
        console.log('Background Script: スコア画像が見つかりませんでした');
        return null;
        
    } catch (error) {
        console.error('Background Script: n/5スコア解析エラー:', error);
        return null;
    }
}

// n% 形式のサクラ度解析関数（簡素化版）
function parseSakuraPercentage(html) {
    try {
        console.log('Background Script: n%サクラ度解析開始');
        
        const imageData = extractScoreFromImages(html);
        
        if (imageData.sakuraImages && imageData.sakuraImages.length > 0) {
            console.log('Background Script: サクラ度画像を返します');
            return createImageDisplayHTML(imageData.sakuraImages, '%');
        }
        
        console.log('Background Script: サクラ度画像が見つかりませんでした');
        return null;
        
    } catch (error) {
        console.error('Background Script: n%サクラ度解析エラー:', error);
        return null;
    }
}

// エクスポート（Service Worker環境では self を使用）
self.ScoreParser = {
    extractScoreFromImages,
    createImageDisplayHTML,
    parseScoreRating,
    parseSakuraPercentage
};