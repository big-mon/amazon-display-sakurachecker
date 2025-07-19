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
    if (!htmlArea) {
        console.log('Background Script: 画像抽出 - HTMLエリアがnullまたは空です');
        return [];
    }
    
    console.log('Background Script: 画像抽出開始 - HTMLエリアサイズ:', htmlArea.length, '文字');
    console.log('Background Script: HTMLエリア内容（最初の200文字）:', htmlArea.substring(0, 200));
    
    // img要素を順序を保持して抽出
    const imgPattern = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    const images = [];
    let match;
    let matchCount = 0;
    
    while ((match = imgPattern.exec(htmlArea)) !== null) {
        matchCount++;
        const src = match[1];
        const fullTag = match[0];
        
        console.log(`Background Script: 画像 ${matchCount} 発見:`, {
            src: src,
            fullTag: fullTag.substring(0, 100) + (fullTag.length > 100 ? '...' : '')
        });
        
        const character = getCharacterFromImageSrc(src);
        console.log(`Background Script: 画像 ${matchCount} 文字認識結果:`, character || '認識失敗');
        
        images.push({
            src: src,
            originalTag: fullTag,
            recognizedChar: character
        });
    }
    
    console.log('Background Script: 画像抽出完了 - 総発見数:', matchCount, '個');
    console.log('Background Script: 認識成功数:', images.filter(img => img.recognizedChar !== null).length, '個');
    console.log('Background Script: 認識失敗数:', images.filter(img => img.recognizedChar === null).length, '個');
    
    // 認識結果の詳細
    if (images.length > 0) {
        console.log('Background Script: 全画像の認識結果:');
        images.forEach((img, index) => {
            console.log(`  画像 ${index + 1}: "${img.recognizedChar || '?'}" <- ${img.src.split('/').pop()}`);
        });
    }
    
    return images;
}

// 画像配列から文字列を復元する関数
function reconstructStringFromImages(images) {
    if (!images || images.length === 0) {
        console.log('Background Script: 文字列復元 - 画像配列が空です');
        return null;
    }
    
    console.log('Background Script: 文字列復元開始 - 画像数:', images.length);
    
    let result = '';
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.recognizedChar) {
            result += img.recognizedChar;
            successCount++;
            console.log(`Background Script: 復元 ${i + 1}/${images.length}: "${img.recognizedChar}" <- ${img.src.split('/').pop()}`);
        } else {
            console.log(`Background Script: 復元失敗 ${i + 1}/${images.length}: 認識できない画像:`, img.src.split('/').pop());
            result += '?'; // 認識失敗をマーク
            failureCount++;
        }
    }
    
    console.log('Background Script: 文字列復元完了:', {
        復元結果: result,
        成功数: successCount,
        失敗数: failureCount,
        復元率: `${Math.round((successCount / images.length) * 100)}%`
    });
    
    return result || null;
}

// n/5 形式のスコア解析関数
function parseScoreRating(html) {
    try {
        console.log('Background Script: n/5スコア解析開始');
        console.log('Background Script: HTML全体サイズ:', html.length, '文字');
        
        // 実際のHTML構造に基づく修正されたXPathパターン
        const xpathPatterns = [
            {
                name: 'n/5評価パターン (item-rating + /5)',
                pattern: /<p[^>]*class=["'][^"']*item-rating[^"']*["'][^>]*>[\s\S]*?\/5[\s\S]*?<\/p>/gi
            },
            {
                name: 'n/5評価パターン (span + /5)',
                pattern: /<span[^>]*>[\s\S]*?<\/span>\/5/gi
            },
            {
                name: 'mainBlockセクション内のn/5パターン',
                pattern: /<section[^>]*class=["'][^"']*mainBlock[^"']*["'][^>]*>[\s\S]*?\/5[\s\S]*?<\/section>/gi
            }
        ];
        
        // HTML構造の基本チェック
        const hasPagetop = html.includes('id="pagetop"') || html.includes("id='pagetop'");
        const hasSections = html.match(/<section/gi);
        const hasDivs = html.match(/<div/gi);
        const hasSpans = html.match(/<span/gi);
        const hasImages = html.match(/<img/gi);
        
        console.log('Background Script: HTML構造基本情報:', {
            hasPagetop: hasPagetop,
            sectionCount: hasSections ? hasSections.length : 0,
            divCount: hasDivs ? hasDivs.length : 0,
            spanCount: hasSpans ? hasSpans.length : 0,
            imageCount: hasImages ? hasImages.length : 0
        });
        
        let targetArea = null;
        let matchedPatternInfo = null;
        
        for (let i = 0; i < xpathPatterns.length; i++) {
            const patternInfo = xpathPatterns[i];
            console.log(`Background Script: XPathパターン試行 ${i + 1}/${xpathPatterns.length}: ${patternInfo.name}`);
            
            const matches = html.match(patternInfo.pattern);
            console.log(`Background Script: パターン ${i + 1} マッチ結果:`, matches ? `${matches.length}個のマッチ` : 'マッチなし');
            
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                matchedPatternInfo = patternInfo;
                console.log(`Background Script: n/5スコアエリア発見! パターン: ${patternInfo.name}`);
                console.log(`Background Script: マッチした領域 (最初の200文字):`, targetArea.substring(0, 200));
                console.log(`Background Script: マッチした領域の画像数:`, (targetArea.match(/<img/gi) || []).length);
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: 全てのXPathパターンでn/5スコアエリアが見つかりませんでした');
            
            // XPathに対応する実際のHTML構造を分析
            console.log('Background Script: 実際のHTML構造を分析します');
            
            // pagetopエリアを抽出
            const pagetopArea = html.match(/id=["']pagetop["'][\s\S]*?<\/div>/gi);
            if (pagetopArea && pagetopArea.length > 0) {
                console.log('Background Script: pagetopエリア発見、最初の1000文字:');
                console.log(pagetopArea[0].substring(0, 1000));
                
                // pagetopエリア内のsection要素を検索
                const sectionsInPagetop = pagetopArea[0].match(/<section[\s\S]*?<\/section>/gi);
                if (sectionsInPagetop) {
                    console.log(`Background Script: pagetop内のsection数: ${sectionsInPagetop.length}`);
                    sectionsInPagetop.forEach((section, index) => {
                        console.log(`Background Script: section[${index}] (最初の200文字):`, section.substring(0, 200));
                    });
                }
            } else {
                console.log('Background Script: pagetopエリアが見つからず、section要素を直接検索します');
                const sections = html.match(/<section[\s\S]*?<\/section>/gi);
                if (sections) {
                    console.log(`Background Script: 全section数: ${sections.length}`);
                    sections.forEach((section, index) => {
                        console.log(`Background Script: section[${index}] (最初の200文字):`, section.substring(0, 200));
                        
                        // サクラ度や評価に関連するsectionを特定
                        if (section.includes('サクラ') || section.includes('評価') || section.includes('/5') || section.includes('%')) {
                            console.log(`Background Script: *** 関連section発見 section[${index}] ***`);
                            console.log('Background Script: 完全なsection内容:');
                            console.log(section);
                        }
                    });
                }
            }
            
            return null;
        }
        
        // 実際のHTML構造に基づくスコア解析
        console.log('Background Script: n/5スコアエリア発見、解析開始:', targetArea.substring(0, 200));
        
        // 1. 直接的なテキストベースの検索（最優先）
        const directTextPatterns = [
            /(\d+\.?\d*)\s*\/\s*5/,
            /(\d+\.\d+)\s*out\s*of\s*5/i,
            /(\d+\.\d+)\s*\/\s*5/,
            /(\d+)\s*\/\s*5/
        ];
        
        for (const pattern of directTextPatterns) {
            const directTextMatch = targetArea.match(pattern);
            if (directTextMatch) {
                console.log('Background Script: n/5スコアをテキストから発見:', directTextMatch[1], 'パターン:', pattern);
                return directTextMatch[1] + '/5';
            }
        }
        
        // 1.5. HTML全体から1.24のような評価値を検索
        const globalRatingMatch = html.match(/\b(\d+\.\d+)\s*\/\s*5\b/);
        if (globalRatingMatch) {
            console.log('Background Script: HTML全体から小数点評価発見:', globalRatingMatch[1]);
            return globalRatingMatch[1] + '/5';
        }
        
        // 2. base64画像を直接抽出して表示用に返す
        const base64ImageMatch = targetArea.match(/<img[^>]*src="(data:image\/[^"]*)"[^>]*>/);
        if (base64ImageMatch) {
            console.log('Background Script: n/5評価用base64画像発見');
            console.log('Background Script: 画像データ:', base64ImageMatch[1].substring(0, 100), '...');
            
            // "/5"テキストと組み合わせて画像表示用のHTMLを作成
            return {
                type: 'image',
                imageData: base64ImageMatch[1],
                suffix: '/5'
            };
        }
        
        // 3. 従来の画像解析（フォールバック）
        const orderedImages = extractOrderedImagesFromArea(targetArea);
        console.log('Background Script: n/5スコアエリア内の画像:', orderedImages.length, '個');
        
        if (orderedImages.length > 0) {
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
        console.log('Background Script: HTML全体サイズ:', html.length, '文字');
        
        // 実際のHTML構造に基づく修正されたサクラ度%パターン
        const xpathPatterns = [
            {
                name: 'サクラ度%パターン (reportBlock + サクラ度)',
                pattern: /<section[^>]*class=["'][^"']*reportBlock[^"']*["'][^>]*>[\s\S]*?サクラ度[\s\S]*?<\/section>/gi
            },
            {
                name: 'サクラ度%パターン (title-darkblue)',
                pattern: /<h2[^>]*class=["'][^"']*title-darkblue[^"']*["'][^>]*>[\s\S]*?サクラ度[\s\S]*?<\/h2>/gi
            },
            {
                name: 'サクラ度%パターン (数字%)',
                pattern: /\d+\s*%[\s\S]*?サクラ度|サクラ度[\s\S]*?\d+\s*%/gi
            }
        ];
        
        // HTML構造の基本チェック（n%サクラ度特有）
        const hasPagetop = html.includes('id="pagetop"') || html.includes("id='pagetop'");
        const hasPercentSign = html.includes('%');
        const hasSakuraKeyword = html.includes('サクラ') || html.includes('sakura');
        const hasPercentImages = html.match(/percent|%|rv_level_spercent/gi);
        
        console.log('Background Script: n%サクラ度HTML構造情報:', {
            hasPagetop: hasPagetop,
            hasPercentSign: hasPercentSign,
            hasSakuraKeyword: hasSakuraKeyword,
            percentImageCount: hasPercentImages ? hasPercentImages.length : 0
        });
        
        let targetArea = null;
        let matchedPatternInfo = null;
        
        for (let i = 0; i < xpathPatterns.length; i++) {
            const patternInfo = xpathPatterns[i];
            console.log(`Background Script: XPathパターン試行 ${i + 1}/${xpathPatterns.length}: ${patternInfo.name}`);
            
            const matches = html.match(patternInfo.pattern);
            console.log(`Background Script: パターン ${i + 1} マッチ結果:`, matches ? `${matches.length}個のマッチ` : 'マッチなし');
            
            if (matches && matches.length > 0) {
                targetArea = matches[0];
                matchedPatternInfo = patternInfo;
                console.log(`Background Script: n%サクラ度エリア発見! パターン: ${patternInfo.name}`);
                console.log(`Background Script: マッチした領域 (最初の200文字):`, targetArea.substring(0, 200));
                console.log(`Background Script: マッチした領域の画像数:`, (targetArea.match(/<img/gi) || []).length);
                console.log(`Background Script: マッチした領域の%記号数:`, (targetArea.match(/%/gi) || []).length);
                break;
            }
        }
        
        if (!targetArea) {
            console.log('Background Script: 全てのXPathパターンでn%サクラ度エリアが見つかりませんでした');
            
            // サクラ度%表示の実際のHTML構造を分析
            console.log('Background Script: サクラ度%表示の実際のHTML構造を分析します');
            
            // より広範囲で99%や高い数値を検索
            const highPercentMatches = html.match(/\b(9[0-9]|8[0-9]|7[0-9])\s*%/g);
            if (highPercentMatches) {
                console.log('Background Script: 高いパーセント値発見:', highPercentMatches);
                
                // 99%周辺のHTMLを詳しく見る
                const ninetyNineMatch = html.match(/.{0,500}99\s*%.{0,500}/);
                if (ninetyNineMatch) {
                    console.log('Background Script: 99%周辺のHTML:');
                    console.log(ninetyNineMatch[0]);
                }
            }
            
            // サクラ度を含むすべてのsection要素を検索
            const sections = html.match(/<section[\s\S]*?<\/section>/gi);
            if (sections) {
                sections.forEach((section, index) => {
                    if (section.includes('サクラ度') && section.includes('%')) {
                        console.log(`Background Script: *** サクラ度%関連section発見 section[${index}] ***`);
                        console.log('Background Script: 完全なsection内容:');
                        console.log(section);
                        
                        // section内のdiv構造を詳しく解析
                        const divs = section.match(/<div[^>]*>[\s\S]*?<\/div>/gi);
                        if (divs) {
                            console.log(`Background Script: section内のdiv数: ${divs.length}`);
                            divs.forEach((div, divIndex) => {
                                if (div.includes('%')) {
                                    console.log(`Background Script: %を含むdiv[${divIndex}]:`, div);
                                }
                            });
                        }
                    }
                });
            }
            
            return null;
        }
        
        // 実際のHTML構造に基づくサクラ度%解析
        console.log('Background Script: n%サクラ度エリア発見、解析開始:', targetArea.substring(0, 300));
        
        // 1. 直接的なテキストベースの検索（最優先）
        const directPercentMatches = targetArea.match(/(\d+)\s*%/g);
        if (directPercentMatches && directPercentMatches.length > 0) {
            console.log('Background Script: %パターン発見:', directPercentMatches);
            
            // 最も大きい数値を選択（サクラ度は通常0-100%）
            let bestScore = null;
            for (const match of directPercentMatches) {
                const scoreMatch = match.match(/(\d+)/);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1]);
                    if (!isNaN(score) && score >= 0 && score <= 100) {
                        if (bestScore === null || score > bestScore) {
                            bestScore = score;
                        }
                    }
                }
            }
            
            if (bestScore !== null) {
                console.log('Background Script: n%サクラ度をテキストから発見:', bestScore);
                return bestScore;
            }
        }
        
        // 2. サクラ度というキーワード周辺の数値検索（より広範囲）
        const sakuraScorePatterns = [
            /サクラ度[^0-9]*(\d+)/,
            /(\d+)[^0-9]*%[^0-9]*サクラ度/,
            /サクラ度[\s\S]*?(\d+)\s*%/,
            /(\d+)\s*%[\s\S]*?サクラ度/
        ];
        
        for (const pattern of sakuraScorePatterns) {
            const sakuraScoreMatch = targetArea.match(pattern);
            if (sakuraScoreMatch) {
                const score = parseInt(sakuraScoreMatch[1]);
                if (!isNaN(score) && score >= 0 && score <= 100) {
                    console.log('Background Script: サクラ度キーワード周辺から発見:', score, 'パターン:', pattern);
                    return score;
                }
            }
        }
        
        // 3. サクラ度%のbase64画像を直接抽出
        const sakuraImageMatch = targetArea.match(/<img[^>]*src="(data:image\/[^"]*)"[^>]*>/);
        if (sakuraImageMatch) {
            console.log('Background Script: サクラ度%用base64画像発見');
            console.log('Background Script: 画像データ:', sakuraImageMatch[1].substring(0, 100), '...');
            
            // パーセント記号と組み合わせて画像表示用のオブジェクトを返す
            return {
                type: 'image',
                imageData: sakuraImageMatch[1],
                suffix: '%'
            };
        }
        
        // 4. 従来の画像解析（フォールバック）
        const orderedImages = extractOrderedImagesFromArea(targetArea);
        console.log('Background Script: n%サクラ度エリア内の画像:', orderedImages.length, '個');
        
        if (orderedImages.length > 0) {
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
        }
        
        console.log('Background Script: n%サクラ度を検出できませんでした');
        return null;
    } catch (error) {
        console.error('Background Script: n%サクラ度解析エラー:', error);
        return null;
    }
}

// エクスポート（Service Worker環境では self を使用）
self.ScoreParser = {
    getCharacterFromImageSrc,
    extractOrderedImagesFromArea,
    reconstructStringFromImages,
    parseScoreRating,
    parseSakuraPercentage,
    CHARACTER_IMAGE_PATTERNS
};