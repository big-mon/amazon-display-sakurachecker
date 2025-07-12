# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome拡張機能でAmazon商品ページにサクラチェック結果を表示する。sakura-checker.jpから画像ベースのスコア情報を抽出して商品ページに埋め込む。

## Development Commands

```bash
# テスト実行
node tests/test-sakura.js

# ブラウザテスト（Chrome拡張として読み込み後）
tests/test-browser.html を開く

# Chrome拡張として読み込み
# Chrome -> 拡張機能 -> デベロッパーモード -> パッケージ化されていない拡張機能を読み込む
```

## Architecture

### モジュール構成

**Content Scripts** (Amazon商品ページで実行):
- `content/asin-extractor.js` - Amazon商品ASINの抽出とページ判定
- `content/ui-display.js` - サクラチェック結果の表示UI作成
- `content/sakura-checker.js` - Background Scriptとの通信管理
- `content.js` - メインの初期化と制御フロー

**Background Scripts** (バックグラウンドで実行):
- `background/score-parser.js` - sakura-checker.jpの画像ベーススコア解析
- `background/api-client.js` - sakura-checker.jp APIとの通信とリトライ制御
- `background.js` - Content Scriptからのメッセージ処理

### データフロー

1. Content Script: Amazon商品ページでASIN抽出
2. Content Script → Background Script: サクラチェック要求
3. Background Script: sakura-checker.jpにHTTP通信
4. Background Script: HTMLから画像ベースでスコア解析（n/5形式、n%形式）
5. Background Script → Content Script: スコア結果を返送
6. Content Script: 商品ページにスコア結果を表示

### 重要な技術的考慮事項

- **画像ベーススコア解析**: sakura-checker.jpはスコアを画像で表示するため、ファイル名パターンマッチングで文字認識
- **XPath解析**: 特定のHTML構造からスコア画像を順序付きで抽出
- **リクエスト制御**: Bot検出回避のため2秒間隔+ランダム遅延
- **重複実行防止**: 同一ASIN処理中はリクエスト抑制
- **動的ページ対応**: MutationObserverでSPAナビゲーション検出

### グローバル変数エクスポート

各モジュールは `window.ModuleName` でグローバルエクスポートし、manifest.jsonの読み込み順序で依存関係を解決。

## 開発時の注意点

- 日本語で回答すること
- TDD原則に従うこと（既存テストファイル参照）
- sakura-checker.jpのレート制限に注意
- Chrome拡張のManifest V3仕様に従うこと
