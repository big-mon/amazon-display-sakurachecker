// UI表示機能モジュール
// サクラチェック結果の表示とUI要素の管理

// 読み込み中の表示を行う関数
function displayLoadingResult() {
    // 既存の結果要素を削除
    const existingResult = document.querySelector('#sakura-checker-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    // 読み込み中表示要素を作成
    const loadingElement = createLoadingElement();
    
    // 挿入位置を特定
    const insertionPoint = findInsertionPoint();
    
    if (insertionPoint) {
        insertionPoint.insertAdjacentElement('afterend', loadingElement);
    } else {
        document.body.insertAdjacentElement('afterbegin', loadingElement);
    }
}

// 読み込み中要素を作成する関数
function createLoadingElement() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'sakura-checker-result';
    
    loadingDiv.innerHTML = `
        <div style="
            background-color: #f8f9fa;
            border: 2px solid #6c757d;
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1000;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            ">
                <span style="
                    background-color: #6c757d;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                ">
                    🌸 サクラチェック
                </span>
                <span style="
                    font-size: 14px;
                    color: #6c757d;
                ">
                    調査中...
                </span>
            </div>
            <div style="
                font-size: 13px;
                color: #555;
                margin-bottom: 8px;
            ">
                サクラ度を調査しています。しばらくお待ちください。
            </div>
            <div style="
                font-size: 11px;
                color: #999;
                text-align: right;
            ">
                Powered by sakura-checker.jp
            </div>
        </div>
    `;
    
    return loadingDiv;
}

// エラー表示を行う関数
function displayErrorResult(errorMessage) {
    // 既存の結果要素を削除
    const existingResult = document.querySelector('#sakura-checker-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    // エラー表示要素を作成
    const errorElement = createErrorElement(errorMessage);
    
    // 挿入位置を特定
    const insertionPoint = findInsertionPoint();
    
    if (insertionPoint) {
        insertionPoint.insertAdjacentElement('afterend', errorElement);
    } else {
        document.body.insertAdjacentElement('afterbegin', errorElement);
    }
}

// エラー要素を作成する関数
function createErrorElement(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'sakura-checker-result';
    
    errorDiv.innerHTML = `
        <div style="
            background-color: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1000;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            ">
                <span style="
                    background-color: #ffc107;
                    color: #212529;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                ">
                    ⚠️ サクラチェック
                </span>
                <span style="
                    font-size: 14px;
                    color: #856404;
                ">
                    エラー
                </span>
            </div>
            <div style="
                font-size: 13px;
                color: #555;
                margin-bottom: 8px;
            ">
                ${errorMessage}
            </div>
            <div style="
                font-size: 11px;
                color: #999;
                text-align: right;
            ">
                Powered by sakura-checker.jp
            </div>
        </div>
    `;
    
    return errorDiv;
}

// 両方のスコアを表示する関数
function displayDualScoreResult(scoreRating, sakuraPercentage, asin) {
    console.log('Amazon Display Sakura Checker: 両スコア表示準備中', {
        scoreRating: scoreRating,
        sakuraPercentage: sakuraPercentage
    });
    
    // 既存の結果要素を削除
    const existingResult = document.querySelector('#sakura-checker-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    // 結果表示要素を作成
    const resultElement = createDualScoreElement(scoreRating, sakuraPercentage, asin);
    
    // 挿入位置を特定
    const insertionPoint = findInsertionPoint();
    
    if (insertionPoint) {
        insertionPoint.insertAdjacentElement('afterend', resultElement);
    } else {
        // フォールバック: body要素の最初に追加
        document.body.insertAdjacentElement('afterbegin', resultElement);
    }
}

// 両方のスコア表示要素を作成する関数
function createDualScoreElement(scoreRating, sakuraPercentage, asin) {
    const resultDiv = document.createElement('div');
    resultDiv.id = 'sakura-checker-result';
    
    // サクラ度に応じた色とメッセージを決定（パーセンテージが優先）
    let color, backgroundColor, message, riskLevel;
    
    if (sakuraPercentage !== null) {
        const scoreInfo = getSakuraScoreInfo(sakuraPercentage);
        color = scoreInfo.color;
        backgroundColor = scoreInfo.backgroundColor;
        message = scoreInfo.message;
        riskLevel = scoreInfo.riskLevel;
    } else {
        // パーセンテージがない場合はニュートラルな色
        color = '#6c757d';
        backgroundColor = '#f8f9fa';
        message = 'スコア情報を取得しました。';
        riskLevel = '情報';
    }
    
    // 表示するスコア情報を構築
    let scoresDisplay = '';
    
    if (sakuraPercentage !== null) {
        // sakuraPercentageが画像オブジェクトかどうかをチェック
        if (typeof sakuraPercentage === 'object' && sakuraPercentage.type === 'image') {
            scoresDisplay += `
                <span style="
                    font-size: 16px;
                    font-weight: bold;
                    color: ${color};
                    margin-right: 10px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                ">
                    サクラ度: 
                    <img src="${sakuraPercentage.imageData}" style="display: inline; vertical-align: middle; max-height: 20px;">
                    ${sakuraPercentage.suffix}
                </span>
            `;
        } else {
            scoresDisplay += `
                <span style="
                    font-size: 16px;
                    font-weight: bold;
                    color: ${color};
                    margin-right: 10px;
                ">
                    サクラ度: ${sakuraPercentage}%
                </span>
            `;
        }
    }
    
    if (scoreRating !== null) {
        // scoreRatingが画像オブジェクトかどうかをチェック
        if (typeof scoreRating === 'object' && scoreRating.type === 'image') {
            scoresDisplay += `
                <span style="
                    font-size: 14px;
                    color: #495057;
                    background-color: #e9ecef;
                    padding: 2px 6px;
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                ">
                    スコア: 
                    <img src="${scoreRating.imageData}" style="display: inline; vertical-align: middle; max-height: 18px;">
                    ${scoreRating.suffix}
                </span>
            `;
        } else {
            scoresDisplay += `
                <span style="
                    font-size: 14px;
                    color: #495057;
                    background-color: #e9ecef;
                    padding: 2px 6px;
                    border-radius: 3px;
                ">
                    スコア: ${scoreRating}
                </span>
            `;
        }
    }
    
    if (!scoresDisplay) {
        scoresDisplay = `
            <span style="
                font-size: 14px;
                color: #6c757d;
            ">
                スコア情報なし
            </span>
        `;
    }
    
    resultDiv.innerHTML = `
        <div style="
            background-color: ${backgroundColor};
            border: 2px solid ${color};
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1000;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            ">
                <span style="
                    background-color: ${color};
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px;
                ">
                    🌸 サクラチェック
                </span>
                ${scoresDisplay}
                ${sakuraPercentage !== null ? `
                <span style="
                    font-size: 12px;
                    color: #666;
                ">
                    ${riskLevel}
                </span>
                ` : ''}
            </div>
            <div style="
                font-size: 13px;
                color: #555;
                margin-bottom: 8px;
            ">
                ${message}
            </div>
            <div style="
                font-size: 11px;
                color: #999;
                text-align: right;
            ">
                Powered by sakura-checker.jp
            </div>
        </div>
    `;
    
    return resultDiv;
}

// サクラ度に応じた表示情報を取得する関数
function getSakuraScoreInfo(sakuraScore) {
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

// 結果を挿入する位置を特定する関数
function findInsertionPoint() {
    // 商品タイトルの後に挿入を試みる
    const productTitle = document.querySelector('#productTitle');
    if (productTitle) {
        return productTitle.parentElement;
    }
    
    // 価格情報の前に挿入を試みる
    const priceElement = document.querySelector('#priceblock_dealprice, #priceblock_ourprice, .a-price');
    if (priceElement) {
        return priceElement.parentElement;
    }
    
    // 商品情報エリアを探す
    const productInfo = document.querySelector('#feature-bullets, #productDescription');
    if (productInfo) {
        return productInfo.parentElement;
    }
    
    // フォールバック: レビューセクションの前
    const reviewSection = document.querySelector('#reviews, #reviewsMedley');
    if (reviewSection) {
        return reviewSection.parentElement;
    }
    
    return null;
}

// エクスポート（グローバルスコープで利用可能にする）
window.UiDisplay = {
    displayLoadingResult,
    displayErrorResult,
    displayDualScoreResult,
    createLoadingElement,
    createErrorElement,
    createDualScoreElement,
    getSakuraScoreInfo,
    findInsertionPoint
};