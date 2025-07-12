// Amazon Display Sakura Checker - Unit Tests
// TDD原則に従ったテスト実装

// テスト用のモック関数
const mockChrome = {
    runtime: {
        sendMessage: null, // テストごとに設定
        onMessage: {
            addListener: function(callback) {
                this.callback = callback;
            },
            callback: null
        }
    }
};

// グローバルなChrome APIをモック
global.chrome = mockChrome;

// テスト対象の関数群
class SakuraCheckerTest {
    constructor() {
        this.testResults = [];
    }

    // テスト実行メソッド
    async runAllTests() {
        console.log('🧪 Amazon Display Sakura Checker - テスト開始');
        
        // Background Script テスト
        await this.testParseSakuraScore();
        await this.testCheckSakuraScore();
        
        // Content Script テスト  
        await this.testExtractProductASIN();
        await this.testIsProductPage();
        await this.testGetSakuraScoreInfo();
        
        // 統合テスト
        await this.testMessageCommunication();
        
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

    // HTML解析テスト
    testParseSakuraScore() {
        console.log('📝 HTML解析テスト実行中...');
        
        // テストケース1: 正常なサクラ度パターン
        const html1 = '<div>サクラ度: 75%</div>';
        const result1 = this.parseSakuraScore(html1);
        this.assert(result1 === 75, 'サクラ度解析1', `期待値: 75, 実際: ${result1}`);
        
        // テストケース2: 別のパターン
        const html2 = '<span>80%のサクラ</span>';
        const result2 = this.parseSakuraScore(html2);
        this.assert(result2 === 80, 'サクラ度解析2', `期待値: 80, 実際: ${result2}`);
        
        // テストケース3: サクラ度が見つからない場合
        const html3 = '<div>商品情報</div>';
        const result3 = this.parseSakuraScore(html3);
        this.assert(result3 === null, 'サクラ度解析3', `期待値: null, 実際: ${result3}`);
        
        // テストケース4: 範囲外の値
        const html4 = '<div>サクラ度: 150%</div>';
        const result4 = this.parseSakuraScore(html4);
        this.assert(result4 === null, 'サクラ度解析4', `期待値: null, 実際: ${result4}`);
    }

    // サクラ度解析関数（Background Scriptから移植）
    parseSakuraScore(html) {
        try {
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
            
            return null;
        } catch (error) {
            return null;
        }
    }

    // Background Script API通信テスト
    async testCheckSakuraScore() {
        console.log('📡 API通信テスト実行中...');
        
        // モックレスポンスを設定
        const mockFetch = (url) => {
            if (url.includes('sakura-checker.jp')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('<div>サクラ度: 65%</div>')
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        };
        
        global.fetch = mockFetch;
        
        try {
            const result = await this.checkSakuraScore('https://amazon.co.jp/dp/TEST123', 'TEST123');
            this.assert(result.success === true, 'API通信1', `通信成功: ${result.success}`);
            this.assert(result.sakuraScore === 65, 'API通信2', `サクラ度: ${result.sakuraScore}`);
            this.assert(result.asin === 'TEST123', 'API通信3', `ASIN: ${result.asin}`);
        } catch (error) {
            this.assert(false, 'API通信エラー', error.message);
        }
    }

    // Background Script関数（簡略版）
    async checkSakuraScore(productURL, asin) {
        try {
            const sakuraCheckerURL = `https://sakura-checker.jp/search/${encodeURIComponent(productURL)}`;
            const response = await fetch(sakuraCheckerURL);
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const html = await response.text();
            const sakuraScore = this.parseSakuraScore(html);
            
            if (sakuraScore !== null) {
                return { success: true, sakuraScore: sakuraScore, asin: asin };
            } else {
                return { success: false, error: 'サクラ度を取得できませんでした', asin: asin };
            }
        } catch (error) {
            return { success: false, error: error.message, asin: asin };
        }
    }

    // ASIN抽出テスト
    testExtractProductASIN() {
        console.log('🔍 ASIN抽出テスト実行中...');
        
        // テストケース1: 標準的なAmazon URL
        const testUrl1 = 'https://www.amazon.co.jp/dp/B08N5WRWNW';
        global.window = { location: { href: testUrl1 } };
        const result1 = this.extractProductASIN();
        this.assert(result1 === 'B08N5WRWNW', 'ASIN抽出1', `期待値: B08N5WRWNW, 実際: ${result1}`);
        
        // テストケース2: gp/product URL
        const testUrl2 = 'https://www.amazon.com/gp/product/B07XYZ1234';
        global.window = { location: { href: testUrl2 } };
        const result2 = this.extractProductASIN();
        this.assert(result2 === 'B07XYZ1234', 'ASIN抽出2', `期待値: B07XYZ1234, 実際: ${result2}`);
        
        // テストケース3: ASINが含まれないURL
        const testUrl3 = 'https://www.amazon.co.jp/';
        global.window = { location: { href: testUrl3 } };
        global.document = { querySelector: () => null };
        const result3 = this.extractProductASIN();
        this.assert(result3 === null, 'ASIN抽出3', `期待値: null, 実際: ${result3}`);
    }

    // ASIN抽出関数（Content Scriptから移植）
    extractProductASIN() {
        // 1. URLからASINを抽出
        const urlMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
        if (urlMatch) {
            return urlMatch[1] || urlMatch[2];
        }
        
        // 2. meta要素からASINを抽出（簡略版）
        if (document && document.querySelector) {
            const metaASIN = document.querySelector('meta[name="title"]');
            if (metaASIN) {
                const content = metaASIN.getAttribute('content');
                const asinMatch = content.match(/([A-Z0-9]{10})/);
                if (asinMatch) {
                    return asinMatch[1];
                }
            }
        }
        
        return null;
    }

    // 商品ページ判定テスト
    testIsProductPage() {
        console.log('📄 商品ページ判定テスト実行中...');
        
        // テストケース1: 商品ページURL
        global.window = { location: { pathname: '/dp/B08N5WRWNW' } };
        const result1 = this.isProductPage();
        this.assert(result1 === true, 'ページ判定1', `商品ページ判定: ${result1}`);
        
        // テストケース2: 非商品ページURL
        global.window = { location: { pathname: '/bestsellers' } };
        global.document = { querySelector: () => null };
        const result2 = this.isProductPage();
        this.assert(result2 === false, 'ページ判定2', `非商品ページ判定: ${result2}`);
    }

    // ページ判定関数（Content Scriptから移植）
    isProductPage() {
        // URLパターンチェック
        const urlPattern = /\/(dp|gp\/product)\/[A-Z0-9]{10}/;
        if (urlPattern.test(window.location.pathname)) {
            return true;
        }
        
        // DOM要素チェック（簡略版）
        if (document && document.querySelector) {
            const productElements = [
                '#productTitle',
                '#priceblock_dealprice',
                '#add-to-cart-button'
            ];
            return productElements.some(selector => document.querySelector(selector));
        }
        
        return false;
    }

    // サクラ度情報取得テスト
    testGetSakuraScoreInfo() {
        console.log('📊 サクラ度情報テスト実行中...');
        
        // テストケース1: 危険レベル
        const info1 = this.getSakuraScoreInfo(85);
        this.assert(info1.riskLevel === '危険', 'スコア情報1', `危険レベル: ${info1.riskLevel}`);
        this.assert(info1.color === '#dc3545', 'スコア情報2', `色: ${info1.color}`);
        
        // テストケース2: 安全レベル
        const info2 = this.getSakuraScoreInfo(25);
        this.assert(info2.riskLevel === '安全', 'スコア情報3', `安全レベル: ${info2.riskLevel}`);
        this.assert(info2.color === '#28a745', 'スコア情報4', `色: ${info2.color}`);
    }

    // サクラ度情報関数（Content Scriptから移植）
    getSakuraScoreInfo(sakuraScore) {
        if (sakuraScore >= 80) {
            return {
                color: '#dc3545',
                backgroundColor: '#fff5f5',
                message: 'サクラの可能性が非常に高いです。レビューに注意してください。',
                riskLevel: '危険'
            };
        } else if (sakuraScore >= 60) {
            return {
                color: '#fd7e14',
                backgroundColor: '#fff8f0',
                message: 'サクラの可能性があります。レビューを慎重に確認してください。',
                riskLevel: '注意'
            };
        } else if (sakuraScore >= 40) {
            return {
                color: '#ffc107',
                backgroundColor: '#fffef0',
                message: 'レビューに多少の疑問があります。',
                riskLevel: '軽微'
            };
        } else {
            return {
                color: '#28a745',
                backgroundColor: '#f8fff8',
                message: 'レビューは比較的信頼できると思われます。',
                riskLevel: '安全'
            };
        }
    }

    // メッセージ通信テスト
    async testMessageCommunication() {
        console.log('💬 メッセージ通信テスト実行中...');
        
        // Background Scriptのメッセージリスナーをシミュレート
        const messageHandler = (request, sender, sendResponse) => {
            if (request.action === 'checkSakuraScore') {
                // 模擬的なレスポンス
                const mockResponse = {
                    success: true,
                    sakuraScore: 45,
                    asin: request.asin
                };
                sendResponse(mockResponse);
                return true;
            }
        };
        
        // モックレスポンスを設定
        mockChrome.runtime.sendMessage = async (message) => {
            return new Promise((resolve) => {
                const mockSender = {};
                messageHandler(message, mockSender, resolve);
            });
        };
        
        // Content Scriptからのメッセージ送信をテスト
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'checkSakuraScore',
                productURL: 'https://amazon.co.jp/dp/TEST123',
                asin: 'TEST123'
            });
            
            this.assert(response.success === true, 'メッセージ通信1', `通信成功: ${response.success}`);
            this.assert(response.sakuraScore === 45, 'メッセージ通信2', `サクラ度: ${response.sakuraScore}`);
            this.assert(response.asin === 'TEST123', 'メッセージ通信3', `ASIN: ${response.asin}`);
        } catch (error) {
            this.assert(false, 'メッセージ通信エラー', error.message);
        }
    }
}

// テスト実行
const tester = new SakuraCheckerTest();
tester.runAllTests();