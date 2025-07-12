// スコア解析機能モジュール
// sakura-checker.jpのHTMLから画像ベースのスコア情報を抽出

// 文字画像マッピング辞書（実際のsakura-checker.jpパターンに基づく）
const CHARACTER_IMAGE_PATTERNS = {
    // サクラチェッカーの実際のパターン（rv_level_sプレフィックス）
    '0': ['rv_level_s00.png', 'rv_level_s0.png', 's0.png'],
    '1': ['rv_level_s01.png', 'rv_level_s1.png', 's1.png'],
    '2': ['rv_level_s02.png', 'rv_level_s2.png', 's2.png'],
    '3': ['rv_level_s03.png', 'rv_level_s3.png', 's3.png'],
    '4': ['rv_level_s04.png', 'rv_level_s4.png', 's4.png'],
    '5': ['rv_level_s05.png', 'rv_level_s5.png', 's5.png'],
    '6': ['rv_level_s06.png', 'rv_level_s6.png', 's6.png'],
    '7': ['rv_level_s07.png', 'rv_level_s7.png', 's7.png'],
    '8': ['rv_level_s08.png', 'rv_level_s8.png', 's8.png'],
    '9': ['rv_level_s09.png', 'rv_level_s9.png', 's9.png'],
    
    // 記号の実際のパターン
    '.': ['rv_level_sdot.png', 'sdot.png'],
    '/': ['rv_level_sslash.png', 'sslash.png', 'slash.png'],
    '%': ['rv_level_spercent.png', 'spercent.png', 'percent.png'],
    
    // フォールバック用の一般的なパターン
    '0_fallback': ['0.png', 'num_0.png', 'digit_0.png'],
    '1_fallback': ['1.png', 'num_1.png', 'digit_1.png'],
    '2_fallback': ['2.png', 'num_2.png', 'digit_2.png'],
    '3_fallback': ['3.png', 'num_3.png', 'digit_3.png'],
    '4_fallback': ['4.png', 'num_4.png', 'digit_4.png'],
    '5_fallback': ['5.png', 'num_5.png', 'digit_5.png'],
    '6_fallback': ['6.png', 'num_6.png', 'digit_6.png'],
    '7_fallback': ['7.png', 'num_7.png', 'digit_7.png'],
    '8_fallback': ['8.png', 'num_8.png', 'digit_8.png'],
    '9_fallback': ['9.png', 'num_9.png', 'digit_9.png'],
    '._fallback': ['dot.png', 'period.png', 'point.png', 'decimal.png'],
    '/_fallback': ['slash.png', 'divide.png', 'separator.png'],
    '%_fallback': ['percent.png', 'percentage.png', 'pct.png']
};

// 画像ファイル名から文字を逆引きする関数
function getCharacterFromImageSrc(imageSrc) {
    const filename = imageSrc.split('/').pop().toLowerCase();
    console.log('Background Script: 画像ファイル名解析中:', filename);
    
    // 実際のサクラチェッカーパターンを優先してマッチング
    for (const [char, patterns] of Object.entries(CHARACTER_IMAGE_PATTERNS)) {
        // フォールバックパターンをスキップ
        if (char.includes('_fallback')) continue;
        
        for (const pattern of patterns) {
            if (filename === pattern || filename.includes(pattern)) {
                console.log(`Background Script: パターンマッチ成功 "${filename}" -> "${char}" (パターン: ${pattern})`);
                return char;
            }
        }
    }
    
    // フォールバックパターンでの再試行
    for (const [char, patterns] of Object.entries(CHARACTER_IMAGE_PATTERNS)) {
        if (!char.includes('_fallback')) continue;
        
        const actualChar = char.replace('_fallback', '');
        for (const pattern of patterns) {
            if (filename.includes(pattern)) {
                console.log(`Background Script: フォールバックマッチ成功 "${filename}" -> "${actualChar}" (パターン: ${pattern})`);
                return actualChar;
            }
        }
    }
    
    // より柔軟な推測ロジック
    
    // サクラチェッカー特有のパターン推測（rv_level_s形式）
    const sakuraPatterns = [
        /rv_level_s(\d+)\.png/,  // rv_level_s01.png, rv_level_s02.png 等
        /rv_level_s(\d)/,        // rv_level_s1, rv_level_s2 等（拡張子なし）
        /s(\d+)\.png/,           // s1.png, s2.png 等（フォールバック）
        /s(\d)/,                 // s1, s2 等（フォールバック）
    ];
    
    for (const pattern of sakuraPatterns) {
        const match = filename.match(pattern);
        if (match) {
            // 0埋めされた数字を正規化（01 -> 1）
            const digit = parseInt(match[1]).toString();
            console.log(`Background Script: サクラチェッカーパターン推測成功 "${filename}" -> "${digit}"`);
            return digit;
        }
    }
    
    // サクラチェッカー記号パターン推測
    if (filename.includes('rv_level_sdot') || filename.includes('sdot')) {
        console.log(`Background Script: サクラチェッカー記号推測成功 "${filename}" -> "."`);
        return '.';
    }
    if (filename.includes('rv_level_sslash') || filename.includes('sslash')) {
        console.log(`Background Script: サクラチェッカー記号推測成功 "${filename}" -> "/"`);
        return '/';
    }
    if (filename.includes('rv_level_spercent') || filename.includes('spercent')) {
        console.log(`Background Script: サクラチェッカー記号推測成功 "${filename}" -> "%"`);
        return '%';
    }
    
    // 数字の推測（複数パターン）
    const digitPatterns = [
        /(\d)/,  // 基本の数字
        /_(\d)_/,  // アンダースコアで囲まれた数字
        /(\d)\./,  // 拡張子前の数字
        /img(\d)/,  // img後の数字
        /num(\d)/,  // num後の数字
        /digit(\d)/,  // digit後の数字
        /figure(\d)/  // figure後の数字
    ];
    
    for (const pattern of digitPatterns) {
        const match = filename.match(pattern);
        if (match) {
            console.log(`Background Script: 数字推測成功 "${filename}" -> "${match[1]}"`);
            return match[1];
        }
    }
    
    // 記号の推測（より詳細）
    const symbolPatterns = [
        { chars: ['.'], keywords: ['dot', 'period', 'point', 'decimal', 'komma'] },
        { chars: ['/'], keywords: ['slash', 'divide', 'separator', 'bar', 'stroke'] },
        { chars: ['%'], keywords: ['percent', 'percentage', 'pct', 'per'] }
    ];
    
    for (const symbolPattern of symbolPatterns) {
        for (const keyword of symbolPattern.keywords) {
            if (filename.includes(keyword)) {
                const char = symbolPattern.chars[0];
                console.log(`Background Script: 記号推測成功 "${filename}" -> "${char}" (キーワード: ${keyword})`);
                return char;
            }
        }
    }
    
    // 特殊な命名パターンの推測
    if (filename.includes('5') && (filename.includes('of') || filename.includes('out'))) {
        console.log(`Background Script: /5パターン推測 "${filename}" -> "/5"`);
        return '/5';
    }
    
    console.log(`Background Script: 画像認識失敗 "${filename}"`);
    return null;
}

// XPath領域内の順序付きimg要素を抽出する関数
function extractOrderedImagesFromArea(htmlArea) {
    if (!htmlArea) return [];
    
    // img要素を順序を保持して抽出
    const imgPattern = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    const images = [];
    let match;
    
    while ((match = imgPattern.exec(htmlArea)) !== null) {
        const src = match[1];
        const character = getCharacterFromImageSrc(src);
        
        images.push({
            src: src,
            originalTag: match[0],
            recognizedChar: character
        });
    }
    
    return images;
}

// 画像配列から文字列を復元する関数
function reconstructStringFromImages(images) {
    if (!images || images.length === 0) return null;
    
    let result = '';
    for (const img of images) {
        if (img.recognizedChar) {
            result += img.recognizedChar;
        } else {
            console.log('Background Script: 認識できない画像:', img.src);
            result += '?'; // 認識失敗をマーク
        }
    }
    
    return result || null;
}

// n/5 形式のスコア解析関数
function parseScoreRating(html) {
    try {
        console.log('Background Script: n/5スコア解析開始');
        
        // XPath: //*[@id="pagetop"]/div/div/div[1]/section[4]/div[3]/div[11]/div/div[1]/p[2]/span
        const xpathPatterns = [
            /id=["']pagetop["'][\s\S]*?section[\s\S]*?div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi,
            /section[\s\S]*?div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi,
            /div[3][\s\S]*?div[11][\s\S]*?p[2][\s\S]*?span[\s\S]*?<\/span>/gi
        ];
        
        let targetArea = null;
        for (let i = 0; i < xpathPatterns.length; i++) {
            const matches = html.match(xpathPatterns[i]);
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                console.log(`Background Script: n/5スコアエリア発見:`, targetArea);
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: n/5スコアエリアが見つかりませんでした');
            return null;
        }
        
        // XPath領域内の順序付き画像を抽出
        const orderedImages = extractOrderedImagesFromArea(targetArea);
        console.log('Background Script: n/5スコアエリア内の画像:', orderedImages.length, '個');
        
        if (orderedImages.length === 0) {
            console.log('Background Script: n/5スコアエリア内に画像が見つかりませんでした');
            
            // フォールバック: テキストベースの検索
            const textMatch = targetArea.match(/(\d+\.?\d*)\s*\/\s*5/);
            if (textMatch) {
                console.log('Background Script: n/5スコアをテキストから発見:', textMatch[1]);
                return textMatch[1] + '/5';
            }
            return null;
        }
        
        // 画像から文字列を復元
        const reconstructedString = reconstructStringFromImages(orderedImages);
        console.log('Background Script: n/5スコア復元結果:', reconstructedString);
        
        if (reconstructedString) {
            // 復元された文字列が有効なn/5形式かチェック
            if (reconstructedString.includes('.') || reconstructedString.match(/^\d+\/5$/) || reconstructedString.match(/^\d+\.\d+$/)) {
                // /5が含まれていない場合は追加
                if (!reconstructedString.includes('/5') && !reconstructedString.includes('5')) {
                    return reconstructedString + '/5';
                } else if (reconstructedString.includes('5') && !reconstructedString.includes('/5')) {
                    return reconstructedString.replace('5', '/5');
                }
                return reconstructedString;
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
        
        // XPath: //*[@id="pagetop"]/div/div/div[1]/section[4]/div[4]/div/p[1]/span
        const xpathPatterns = [
            /id=["']pagetop["'][\s\S]*?section[\s\S]*?div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi,
            /section[\s\S]*?div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi,
            /div[4][\s\S]*?p[1][\s\S]*?span[\s\S]*?<\/span>/gi
        ];
        
        let targetArea = null;
        for (let i = 0; i < xpathPatterns.length; i++) {
            const matches = html.match(xpathPatterns[i]);
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                console.log(`Background Script: n%サクラ度エリア発見:`, targetArea);
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: n%サクラ度エリアが見つかりませんでした');
            return null;
        }
        
        // XPath領域内の順序付き画像を抽出
        const orderedImages = extractOrderedImagesFromArea(targetArea);
        console.log('Background Script: n%サクラ度エリア内の画像:', orderedImages.length, '個');
        
        if (orderedImages.length === 0) {
            console.log('Background Script: n%サクラ度エリア内に画像が見つかりませんでした');
            
            // フォールバック: テキストベースの検索
            const textMatch = targetArea.match(/(\d+)\s*%/);
            if (textMatch) {
                const score = parseInt(textMatch[1]);
                console.log('Background Script: n%サクラ度をテキストから発見:', score);
                if (!isNaN(score) && score >= 0 && score <= 100) {
                    return score;
                }
            }
            return null;
        }
        
        // 画像から文字列を復元
        const reconstructedString = reconstructStringFromImages(orderedImages);
        console.log('Background Script: n%サクラ度復元結果:', reconstructedString);
        
        if (reconstructedString) {
            // %記号を除去して数値のみ抽出
            const numericString = reconstructedString.replace(/%/g, '');
            const score = parseInt(numericString);
            
            console.log('Background Script: n%サクラ度数値変換:', numericString, '->', score);
            
            if (!isNaN(score) && score >= 0 && score <= 100) {
                return score;
            }
            
            // 複数桁の場合の処理（例: "99" または "9?9"のような部分認識）
            if (numericString.length >= 2) {
                // ?マークを0で置換して試行
                const cleanedString = numericString.replace(/\?/g, '0');
                const fallbackScore = parseInt(cleanedString);
                
                if (!isNaN(fallbackScore) && fallbackScore >= 0 && fallbackScore <= 100) {
                    console.log('Background Script: フォールバック数値変換:', fallbackScore);
                    return fallbackScore;
                }
            }
        }
        
        console.log('Background Script: n%サクラ度を検出できませんでした');
        return null;
    } catch (error) {
        console.error('Background Script: n%サクラ度解析エラー:', error);
        return null;
    }
}

// エクスポート（グローバルスコープで利用可能にする）
window.ScoreParser = {
    getCharacterFromImageSrc,
    extractOrderedImagesFromArea,
    reconstructStringFromImages,
    parseScoreRating,
    parseSakuraPercentage,
    CHARACTER_IMAGE_PATTERNS
};