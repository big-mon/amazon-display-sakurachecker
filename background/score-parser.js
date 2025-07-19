// スコア解析機能モジュール
// sakura-checker.jpから画像を直接抽出

function extractScoreFromImages(html) {
    try {
        console.log('Background Script: base64画像からスコア抽出開始');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        let scoreImages = [];
        let sakuraImages = [];
        
        const scoreSection = Array.from(doc.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('/5') && !el.textContent.includes('%')
        );
        
        if (scoreSection) {
            const base64Images = scoreSection.querySelectorAll('img[src^="data:image/png;base64"]');
            console.log('Background Script: スコア評価セクション内の画像数:', base64Images.length);
            
            scoreImages = Array.from(base64Images).map(img => ({
                src: img.src,
                alt: img.alt || '',
                fullUrl: img.src
            }));
        }
        
        const sakuraSection = Array.from(doc.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('%') && el.textContent.includes('です。')
        );
        
        if (sakuraSection) {
            const base64Images = sakuraSection.querySelectorAll('img[src^="data:image/png;base64"]');
            console.log('Background Script: サクラ度セクション内の画像数:', base64Images.length);
            
            sakuraImages = Array.from(base64Images).map(img => ({
                src: img.src,
                alt: img.alt || '',
                fullUrl: img.src
            }));
        }
        
        console.log('Background Script: 抽出されたスコア評価画像:', scoreImages.length);
        console.log('Background Script: 抽出されたサクラ度画像:', sakuraImages.length);
        
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
        `<img src="${img.fullUrl}" style="display: inline-block; height: 16px; vertical-align: middle; margin: 0 1px;" alt="${img.alt}">`
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
