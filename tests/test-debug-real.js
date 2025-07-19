// Amazon Display Sakura Checker - 実際のサクラチェッカーAPIデバッグテスト
// XPath解析とスコア取得のデバッグログ確認用

// モジュールを動的に読み込み
const fs = require('fs');

// Background Scriptモジュールを文字列として読み込み
const scoreParserContent = fs.readFileSync('./background/score-parser.js', 'utf-8');
const apiClientContent = fs.readFileSync('./background/api-client.js', 'utf-8');

// windowオブジェクトを作成してグローバルコンテキストをシミュレート
global.window = {};

// fetch APIをNode.js環境で利用できるようにする
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
            // バイナリデータを適切に処理するためのバッファ配列
            const chunks = [];
            
            res.on('data', chunk => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                // バッファを結合
                const buffer = Buffer.concat(chunks);
                
                // Content-Typeからエンコーディングを判定
                const contentType = res.headers['content-type'] || '';
                let encoding = 'utf8';
                
                if (contentType.includes('charset=')) {
                    const charsetMatch = contentType.match(/charset=([^;]+)/i);
                    if (charsetMatch) {
                        encoding = charsetMatch[1].toLowerCase().replace('-', '');
                        // 一般的なエンコーディング名の正規化
                        if (encoding === 'utf8' || encoding === 'utf-8') encoding = 'utf8';
                        else if (encoding === 'shiftjis' || encoding === 'shift_jis') encoding = 'shift_jis';
                        else if (encoding === 'eucjp' || encoding === 'euc-jp') encoding = 'eucjp';
                    }
                }
                
                console.log('Node.js Fetch: エンコーディング情報:', {
                    contentType: contentType,
                    detectedEncoding: encoding,
                    bufferLength: buffer.length
                });
                
                // 適切なエンコーディングでデコード
                let data;
                try {
                    if (encoding === 'shift_jis' || encoding === 'eucjp') {
                        // Node.jsの標準ライブラリでは日本語エンコーディングの変換は限定的
                        // UTF-8として処理を試行
                        data = buffer.toString('utf8');
                        console.log('Node.js Fetch: 日本語エンコーディング検出、UTF-8として処理');
                    } else {
                        data = buffer.toString(encoding);
                    }
                } catch (error) {
                    console.log('Node.js Fetch: エンコーディングエラー、UTF-8として再試行:', error.message);
                    data = buffer.toString('utf8');
                }
                
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
        
        if (options.signal && options.signal.aborted) {
            req.destroy();
            reject(new Error('AbortError'));
        }
        
        req.end();
    });
};

// AbortControllerが利用できない場合のフォールバック
if (typeof AbortController === 'undefined') {
    global.AbortController = class {
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    };
}

// Background Scriptモジュールを評価して関数を利用可能にする
eval(scoreParserContent);
eval(apiClientContent);

class SakuraDebugTester {
    constructor() {
        this.testResults = [];
    }

    async runDebugTest() {
        console.log('🔍 Amazon Display Sakura Checker - 実際のデバッグテスト開始');
        console.log('==========================================');
        
        // テスト用のASINリスト（実際の商品）
        const testASINs = [
            'B0921THFXZ'  // 実際の存在する商品
        ];
        
        for (let i = 0; i < testASINs.length; i++) {
            const asin = testASINs[i];
            console.log(`\n📝 テストケース ${i + 1}/${testASINs.length}: ASIN ${asin}`);
            console.log('==========================================');
            
            await this.testRealSakuraScore(asin);
            
            // APIリクエスト間の適切な間隔を確保
            if (i < testASINs.length - 1) {
                console.log('\n⏳ 次のテストまで3秒待機...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        this.showResults();
    }

    async testRealSakuraScore(asin) {
        try {
            console.log(`🚀 ASIN ${asin} のサクラチェッカー解析開始`);
            
            // 実際のAmazon商品URLを構築
            const productURL = `https://www.amazon.co.jp/dp/${asin}`;
            console.log('📊 商品URL:', productURL);
            
            // 実際のAPIを呼び出してデバッグログを確認
            const result = await window.ApiClient.checkSakuraScore(productURL, asin);
            
            console.log('\n📈 最終結果:', {
                success: result.success,
                scoreRating: result.scoreRating,
                sakuraPercentage: result.sakuraPercentage,
                error: result.error || 'なし'
            });
            
            // テスト結果を記録
            this.testResults.push({
                asin: asin,
                success: result.success,
                scoreRating: result.scoreRating,
                sakuraPercentage: result.sakuraPercentage,
                error: result.error,
                hasAtLeastOneScore: result.scoreRating !== null || result.sakuraPercentage !== null
            });
            
        } catch (error) {
            console.error('❌ テスト実行エラー:', error.message);
            console.error('❌ エラースタック:', error.stack);
            
            this.testResults.push({
                asin: asin,
                success: false,
                error: error.message,
                hasAtLeastOneScore: false
            });
        }
    }

    showResults() {
        console.log('\n\n🎯 デバッグテスト結果サマリー');
        console.log('==========================================');
        
        this.testResults.forEach((result, index) => {
            console.log(`\n📋 テスト ${index + 1}: ASIN ${result.asin}`);
            console.log(`   成功: ${result.success ? '✅' : '❌'}`);
            console.log(`   n/5スコア: ${result.scoreRating || 'なし'}`);
            console.log(`   n%サクラ度: ${result.sakuraPercentage || 'なし'}`);
            console.log(`   少なくとも1つスコア取得: ${result.hasAtLeastOneScore ? '✅' : '❌'}`);
            if (result.error) {
                console.log(`   エラー: ${result.error}`);
            }
        });
        
        const successCount = this.testResults.filter(r => r.success).length;
        const scoreObtainedCount = this.testResults.filter(r => r.hasAtLeastOneScore).length;
        
        console.log('\n📊 統計:');
        console.log(`   総テスト数: ${this.testResults.length}`);
        console.log(`   成功したテスト: ${successCount}/${this.testResults.length}`);
        console.log(`   スコア取得できたテスト: ${scoreObtainedCount}/${this.testResults.length}`);
        
        if (scoreObtainedCount === 0) {
            console.log('\n⚠️  全てのテストでスコアが取得できませんでした。');
            console.log('   XPath解析またはHTML構造に問題がある可能性があります。');
            console.log('   上記のデバッグログを確認してください。');
        } else if (scoreObtainedCount < this.testResults.length) {
            console.log('\n⚠️  一部のテストでスコアが取得できませんでした。');
            console.log('   商品が存在しないか、サクラチェッカーで解析されていない可能性があります。');
        } else {
            console.log('\n🎉 全てのテストでスコアが取得できました！');
        }
    }
}

// メイン実行
async function main() {
    try {
        const tester = new SakuraDebugTester();
        await tester.runDebugTest();
    } catch (error) {
        console.error('🚨 テスト実行中に致命的なエラーが発生しました:', error);
    }
}

// Node.jsで実行する場合
if (require.main === module) {
    main();
}

module.exports = SakuraDebugTester;