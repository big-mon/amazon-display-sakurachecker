// サクラチェッカーHTMLの詳細分析スクリプト
// 実際のHTML構造を理解してXPathパターンを改善するため

const fs = require('fs');
const https = require('https');

// Fetch APIのポリフィル（文字エンコーディング対応版）
global.fetch = function(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 20000
        };

        const req = https.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', chunk => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const data = buffer.toString('utf8');
                
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    text: () => Promise.resolve(data),
                    headers: {
                        get: (name) => res.headers[name.toLowerCase()]
                    }
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));
        req.end();
    });
};

class HTMLAnalyzer {
    async analyzeHTMLStructure() {
        console.log('🔍 サクラチェッカーHTML構造分析開始');
        
        const testASIN = 'B08N5WRWNW';
        const sakuraCheckerURL = `https://sakura-checker.jp/search/${testASIN}/`;
        
        try {
            console.log(`📡 取得URL: ${sakuraCheckerURL}`);
            
            const response = await fetch(sakuraCheckerURL, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'identity',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const html = await response.text();
            console.log(`📄 HTML取得成功: ${html.length} 文字`);
            
            // HTMLを詳細分析
            this.analyzeScoreStructure(html);
            
        } catch (error) {
            console.error('❌ 分析エラー:', error.message);
        }
    }
    
    analyzeScoreStructure(html) {
        console.log('\n🏗️ HTML構造分析開始');
        
        // 1. サクラ度関連のキーワード検索
        const sakuraKeywords = [
            'サクラ度',
            'サクラチェック',
            'サクラ度（怪しさ）',
            'サクラレビュー',
            '危険度',
            '信頼度'
        ];
        
        console.log('\n📍 サクラ度関連キーワード検索:');
        sakuraKeywords.forEach(keyword => {
            const count = (html.match(new RegExp(keyword, 'g')) || []).length;
            console.log(`  ${keyword}: ${count}回`);
            
            if (count > 0) {
                // キーワード周辺のHTMLを抽出
                const regex = new RegExp(`.{0,200}${keyword}.{0,200}`, 'g');
                const matches = html.match(regex);
                if (matches) {
                    console.log(`    周辺HTML: ${matches[0].substring(0, 150)}...`);
                }
            }
        });
        
        // 2. セクション構造の分析
        console.log('\n🏷️ セクション構造分析:');
        const sectionMatches = html.match(/<section[^>]*class="[^"]*"[^>]*>[\s\S]*?<\/section>/gi);
        if (sectionMatches) {
            console.log(`  セクション数: ${sectionMatches.length}`);
            sectionMatches.forEach((section, index) => {
                const classMatch = section.match(/class="([^"]*)"/);
                const titleMatch = section.match(/<h[1-6][^>]*>([^<]+)</i);
                
                if (classMatch || titleMatch) {
                    console.log(`  セクション ${index + 1}:`);
                    if (classMatch) console.log(`    クラス: ${classMatch[1]}`);
                    if (titleMatch) console.log(`    タイトル: ${titleMatch[1]}`);
                    
                    // サクラ度関連のセクションかチェック
                    if (section.includes('サクラ度') || section.includes('サクラチェック')) {
                        console.log(`    🎯 サクラ度関連セクション発見!`);
                        this.analyzeScoreSection(section, index + 1);
                    }
                }
            });
        }
        
        // 3. 画像パターンの分析
        console.log('\n🖼️ 画像パターン分析:');
        const imageMatches = html.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
        if (imageMatches) {
            console.log(`  画像総数: ${imageMatches.length}`);
            
            const scoreImages = imageMatches.filter(img => 
                img.includes('rv_level_s') || 
                img.includes('/s') || 
                img.includes('score') ||
                img.includes('percent') ||
                /s\d+\.png/.test(img)
            );
            console.log(`  スコア関連画像候補: ${scoreImages.length}`);
            scoreImages.slice(0, 5).forEach(img => {
                const srcMatch = img.match(/src="([^"]*)"/);
                if (srcMatch) {
                    console.log(`    ${srcMatch[1]}`);
                }
            });
        }
        
        // 4. パーセント記号周辺の分析
        console.log('\n% パーセント記号周辺分析:');
        const percentMatches = html.match(/.{0,50}%{1}.{0,50}/g);
        if (percentMatches && percentMatches.length > 0) {
            console.log(`  パーセント記号出現: ${percentMatches.length}回`);
            // 数字+%パターンを探す
            const numberPercentMatches = html.match(/\d+\s*%/g);
            if (numberPercentMatches) {
                console.log(`  数字+%パターン: ${numberPercentMatches.length}回`);
                console.log(`  パターン例: ${numberPercentMatches.slice(0, 10).join(', ')}`);
            }
        }
    }
    
    analyzeScoreSection(sectionHTML, sectionNumber) {
        console.log(`\n🔬 セクション ${sectionNumber} 詳細分析:`);
        
        // セクション内のdiv構造
        const divMatches = sectionHTML.match(/<div[^>]*>/gi);
        console.log(`  div要素数: ${divMatches ? divMatches.length : 0}`);
        
        // セクション内のspan要素
        const spanMatches = sectionHTML.match(/<span[^>]*>[\s\S]*?<\/span>/gi);
        console.log(`  span要素数: ${spanMatches ? spanMatches.length : 0}`);
        
        // セクション内のp要素
        const pMatches = sectionHTML.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
        console.log(`  p要素数: ${pMatches ? pMatches.length : 0}`);
        
        // 画像要素
        const imgMatches = sectionHTML.match(/<img[^>]*>/gi);
        console.log(`  img要素数: ${imgMatches ? imgMatches.length : 0}`);
        
        // セクションの最初の500文字を出力
        console.log(`  内容サンプル: ${sectionHTML.substring(0, 500)}...`);
        
        // 可能性のあるスコア表示パターンを検索
        this.findScorePatternsInSection(sectionHTML);
    }
    
    findScorePatternsInSection(sectionHTML) {
        console.log('  🎯 スコアパターン検索:');
        
        // n/5パターン
        const rating5Patterns = [
            /(\d+\.?\d*)\s*\/\s*5/g,
            /(\d+\.?\d*)\s*out\s*of\s*5/gi,
            /(\d+\.?\d*)\s*星/g
        ];
        
        rating5Patterns.forEach((pattern, index) => {
            const matches = sectionHTML.match(pattern);
            if (matches) {
                console.log(`    n/5パターン ${index + 1}: ${matches.join(', ')}`);
            }
        });
        
        // パーセントパターン
        const percentPatterns = [
            /(\d+)\s*%/g,
            /(\d+\.?\d*)\s*パーセント/g
        ];
        
        percentPatterns.forEach((pattern, index) => {
            const matches = sectionHTML.match(pattern);
            if (matches) {
                console.log(`    %パターン ${index + 1}: ${matches.join(', ')}`);
            }
        });
        
        // 画像ベースのスコア
        const scoreImagePattern = /<img[^>]*src="[^"]*(?:rv_level_s|score|s\d+)[^"]*"[^>]*>/gi;
        const scoreImages = sectionHTML.match(scoreImagePattern);
        if (scoreImages) {
            console.log(`    スコア画像: ${scoreImages.length}個`);
        }
    }
}

// 実行
async function main() {
    const analyzer = new HTMLAnalyzer();
    await analyzer.analyzeHTMLStructure();
}

main().catch(console.error);