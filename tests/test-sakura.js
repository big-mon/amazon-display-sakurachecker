// Amazon Display Sakura Checker - Real API Tests
// 実際のサクラチェッカーAPIを使用したテスト

// テスト対象の関数群を読み込み
const fs = require('fs');
const path = require('path');

// score-parser.jsの内容を読み込み
const scoreParserPath = path.join(__dirname, '../background/score-parser.js');
const scoreParserCode = fs.readFileSync(scoreParserPath, 'utf8');

// api-client.jsの内容を読み込み
const apiClientPath = path.join(__dirname, '../background/api-client.js');
const apiClientCode = fs.readFileSync(apiClientPath, 'utf8');

// fetch APIのポリフィル
const { default: fetch } = require('node-fetch');
global.fetch = fetch;

// DOMParserのモック
class DOMParserMock {
    parseFromString(html, type) {
        return {
            querySelectorAll: (selector) => {
                if (selector === 'img[src*="/images/icon_rv"]') {
                    // 実際のサクラチェッカーから取得した画像パターンをシミュレート
                    const images = [];
                    const matches = html.match(/\/images\/icon_rv\d+\.png/g);
                    if (matches) {
                        matches.forEach(src => {
                            images.push({
                                src: src,
                                alt: '',
                                startsWith: (prefix) => src.startsWith(prefix)
                            });
                        });
                    }
                    return images;
                }
                return [];
            }
        };
    }
}

global.DOMParser = DOMParserMock;

// Service Workerグローバルオブジェクトのモック
global.self = {
    ScoreParser: {},
    ApiClient: {}
};

// score-parser.jsから必要な関数を抽出して実行
const cleanedScoreParserCode = scoreParserCode
    .replace(/console\.log/g, '// console.log')
    .replace(/console\.error/g, '// console.error');

// ChromeのAPIを削除してNode.js環境で実行可能にする
const nodeCompatibleCode = cleanedScoreParserCode.replace(/self\.ScoreParser\s*=\s*{[^}]*};/, `
global.self.ScoreParser = {
    extractScoreFromImages: extractScoreFromImages,
    createImageDisplayHTML: createImageDisplayHTML,
    parseScoreRating: parseScoreRating,
    parseSakuraPercentage: parseSakuraPercentage
};
`);

eval(nodeCompatibleCode);

class RealSakuraCheckerTest {
    constructor() {
        this.testResults = [];
    }

    // テスト実行メソッド
    async runAllTests() {
        console.log('🧪 Amazon Display Sakura Checker - 実際のAPI使用テスト開始');
        
        // 実際のサクラチェッカーテスト
        await this.testRealSakuraChecker();
        
        // 画像抽出テスト
        await this.testImageExtraction();
        
        this.showResults();
    }

    // テスト結果表示
    showResults() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        console.log(`\n📊 テスト結果: ${passed}/${total} パス`);
        
        this.testResults.forEach(result => {
            const emoji = result.passed ? '✅' : '❌';
            console.log(`${emoji} ${result.name}: ${result.message}`);
        });
        
        if (passed === total) {
            console.log('🎉 全てのテストが成功しました！');
        } else {
            console.log('⚠️ 一部のテストが失敗しました。');
        }
    }

    // アサーション関数
    assert(condition, testName, message) {
        this.testResults.push({
            name: testName,
            passed: condition,
            message: message
        });
    }

    // 実際のサクラチェッカーAPIテスト
    async testRealSakuraChecker() {
        console.log('🌐 実際のサクラチェッカーAPIテスト実行中...');
        
        try {
            // 実際のASINでテスト (Amazon Echo Dotなど人気商品)
            const testASIN = 'B08N5WRWNW';
            const sakuraURL = `https://sakura-checker.jp/search/${testASIN}/`;
            
            console.log(`📡 リクエスト送信: ${sakuraURL}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
            
            const response = await fetch(sakuraURL, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            console.log(`📊 レスポンス受信: ${response.status} ${response.statusText}`);
            
            this.assert(response.ok, '実API通信1', `HTTP通信成功: ${response.status}`);
            
            if (response.ok) {
                const html = await response.text();
                
                console.log(`📄 HTML取得完了: ${html.length}文字`);
                console.log(`🔍 HTMLサンプル: ${html.substring(0, 200)}...`);
                
                // 実際の画像パターンを探す
                const imageMatches = html.match(/<img[^>]*src="[^"]*"[^>]*>/gi) || [];
                console.log(`📷 総img要素数: ${imageMatches.length}`);
                
                // 画像srcのパターンを分析
                const imageSources = imageMatches.map(img => {
                    const srcMatch = img.match(/src="([^"]*)"/);
                    return srcMatch ? srcMatch[1] : null;
                }).filter(src => src !== null);
                
                console.log(`🔍 画像ソースサンプル (最初の20個):`);
                imageSources.slice(0, 20).forEach((src, index) => {
                    console.log(`  ${index + 1}: ${src}`);
                });
                
                // 数字関連の画像を特に探す
                const numberImages = imageSources.filter(src => 
                    src.includes('数字') || 
                    src.includes('digit') || 
                    src.includes('number') ||
                    /\d/.test(src.split('/').pop()) ||
                    src.includes('score') ||
                    src.includes('rating') ||
                    src.includes('percent')
                );
                
                console.log(`🔢 数字関連画像候補 (${numberImages.length}個):`);
                numberImages.forEach((src, index) => {
                    console.log(`  ${index + 1}: ${src}`);
                });
                
                // base64画像も探す
                const base64Images = imageSources.filter(src => src.startsWith('data:image'));
                console.log(`📊 base64画像数: ${base64Images.length}`);
                if (base64Images.length > 0) {
                    console.log(`🔍 base64画像サンプル:`);
                    base64Images.slice(0, 3).forEach((src, index) => {
                        console.log(`  ${index + 1}: ${src.substring(0, 100)}...`);
                    });
                }
                
                this.assert(html.length > 1000, '実API通信2', `HTMLサイズ: ${html.length}文字`);
                this.assert(html.includes('<html'), '実API通信3', 'HTML形式確認');
                
                // サクラチェッカー特有の要素をチェック
                const hasSakuraKeyword = html.includes('サクラ') || html.includes('sakura');
                const hasImages = html.includes('/images/icon_rv');
                const hasPercentage = html.includes('%');
                
                this.assert(hasSakuraKeyword, '実API内容1', `サクラキーワード: ${hasSakuraKeyword}`);
                this.assert(hasImages, '実API内容2', `icon_rv画像: ${hasImages}`);
                this.assert(hasPercentage, '実API内容3', `パーセンテージ: ${hasPercentage}`);
                
                // 実際の画像抽出テスト
                const imageData = global.self.ScoreParser.extractScoreFromImages(html);
                
                console.log('🖼️ 画像抽出結果:', {
                    sakuraImages: imageData.sakuraImages ? imageData.sakuraImages.length : 0,
                    scoreImages: imageData.scoreImages ? imageData.scoreImages.length : 0
                });
                
                this.assert(imageData.sakuraImages.length > 0 || imageData.scoreImages.length > 0, 
                           '画像抽出1', `総画像数: ${(imageData.sakuraImages.length || 0) + (imageData.scoreImages.length || 0)}`);
                
                // 実際のスコア解析テスト
                const sakuraPercentage = global.self.ScoreParser.parseSakuraPercentage(html);
                const scoreRating = global.self.ScoreParser.parseScoreRating(html);
                
                console.log('📈 スコア解析結果:', {
                    sakuraPercentage: sakuraPercentage,
                    scoreRating: scoreRating
                });
                
                // 少なくとも一つは取得できることを期待
                this.assert(sakuraPercentage !== null || scoreRating !== null, 
                           'スコア解析1', `サクラ度: ${sakuraPercentage ? 'あり' : 'なし'}, スコア: ${scoreRating ? 'あり' : 'なし'}`);
                
                if (sakuraPercentage && typeof sakuraPercentage === 'object') {
                    this.assert(sakuraPercentage.type === 'html', 'スコア解析2', `サクラ度タイプ: ${sakuraPercentage.type}`);
                    this.assert(sakuraPercentage.htmlContent && sakuraPercentage.htmlContent.length > 0, 
                               'スコア解析3', `サクラ度HTML長: ${sakuraPercentage.htmlContent ? sakuraPercentage.htmlContent.length : 0}`);
                }
                
                if (scoreRating && typeof scoreRating === 'object') {
                    this.assert(scoreRating.type === 'html', 'スコア解析4', `評価タイプ: ${scoreRating.type}`);
                    this.assert(scoreRating.htmlContent && scoreRating.htmlContent.length > 0, 
                               'スコア解析5', `評価HTML長: ${scoreRating.htmlContent ? scoreRating.htmlContent.length : 0}`);
                }
                
            } else {
                this.assert(false, '実API通信エラー', `HTTPエラー: ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ 実API通信エラー:', error.message);
            this.assert(false, '実API通信例外', `エラー: ${error.message}`);
        }
    }

    // 画像抽出の詳細テスト
    async testImageExtraction() {
        console.log('🖼️ 画像抽出詳細テスト実行中...');
        
        // 実際のサクラチェッカーHTMLパターンをシミュレート
        const mockHTML = `
            <html>
                <body>
                    <div id="pagetop">
                        <section>
                            <img src="/images/icon_rv01.png" alt="">
                            <img src="/images/icon_rv09.png" alt="">
                            <img src="/images/icon_rv09.png" alt="">
                            <img src="/images/icon_rv10.png" alt="">
                        </section>
                        <section>
                            <img src="/images/icon_rv01.png" alt="">
                            <img src="/images/icon_rv06.png" alt="">
                            <img src="/images/icon_rv02.png" alt="">
                            <img src="/images/icon_rv04.png" alt="">
                            <img src="/images/icon_rv05.png" alt="">
                            <img src="/images/icon_rv05.png" alt="">
                        </section>
                    </div>
                </body>
            </html>
        `;
        
        const imageData = global.self.ScoreParser.extractScoreFromImages(mockHTML);
        
        console.log('🔍 モック画像抽出結果:', imageData);
        
        this.assert(imageData.sakuraImages.length > 0, 'モック画像1', `サクラ度画像数: ${imageData.sakuraImages.length}`);
        this.assert(imageData.scoreImages.length > 0, 'モック画像2', `評価画像数: ${imageData.scoreImages.length}`);
        
        // HTML生成テスト
        const sakuraHTML = global.self.ScoreParser.createImageDisplayHTML(imageData.sakuraImages, '%');
        const scoreHTML = global.self.ScoreParser.createImageDisplayHTML(imageData.scoreImages, '/5');
        
        this.assert(sakuraHTML && sakuraHTML.type === 'html', 'HTML生成1', `サクラ度HTML生成: ${sakuraHTML ? 'OK' : 'NG'}`);
        this.assert(scoreHTML && scoreHTML.type === 'html', 'HTML生成2', `評価HTML生成: ${scoreHTML ? 'OK' : 'NG'}`);
        
        if (sakuraHTML) {
            this.assert(sakuraHTML.htmlContent.includes('img'), 'HTML内容1', `サクラ度にimg要素含有: ${sakuraHTML.htmlContent.includes('img')}`);
            this.assert(sakuraHTML.htmlContent.includes('sakura-checker.jp'), 'HTML内容2', `サクラ度に正しいURL: ${sakuraHTML.htmlContent.includes('sakura-checker.jp')}`);
        }
        
        if (scoreHTML) {
            this.assert(scoreHTML.htmlContent.includes('img'), 'HTML内容3', `評価にimg要素含有: ${scoreHTML.htmlContent.includes('img')}`);
            this.assert(scoreHTML.htmlContent.includes('/5'), 'HTML内容4', `評価に/5接尾辞: ${scoreHTML.htmlContent.includes('/5')}`);
        }
    }
}

// テスト実行
const tester = new RealSakuraCheckerTest();
tester.runAllTests().catch(console.error);