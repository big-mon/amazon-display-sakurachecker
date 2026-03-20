# Amazon Display Sakura Checker

`Amazon Display Sakura Checker` は、Amazon.co.jp の商品ページ上に Sakura Checker の評価画像を表示する Chrome 拡張です。

Chrome Web Store での公開を前提に、利用者向けには権限・通信・保存データの扱いを、開発者向けにはセットアップ・テスト・配布手順をまとめています。

## 利用者向け

### できること

この拡張の目的は 1 つです。

- Amazon.co.jp の商品ページから ASIN を取得する
- Sakura Checker の該当ページを参照する
- 取得できた評価画像と判定文を Amazon 商品ページ内に表示する

それ以外の用途には使いません。

### 使い方

Amazon.co.jp の商品ページを開くと、商品タイトル付近に Sakura Checker の表示ブロックを追加します。

- 読み込み中表示
- Sakura Checker の評価画像
- 判定画像と判定文
- Sakura Checker の元ページへのリンク

ページ外への自動投稿、レビュー投稿、クリック代行は行いません。

### 動作対象

- 対応サイト: `https://www.amazon.co.jp/*`
- 対応ページ: 商品詳細ページ
- 非対応: Amazon.co.jp 以外のドメイン、Sakura Checker に対象商品が存在しない商品

### 読み取る情報

この拡張は Amazon.co.jp の商品ページで次の情報だけを参照します。

- 商品ページ URL
- ページ内に含まれる ASIN

レビュー本文、購入履歴、氏名、住所、支払い情報、Amazon アカウント情報を読む実装はありません。

### 外部通信

外部通信先は次の 1 つだけです。

- [Sakura Checker](https://sakura-checker.jp/)

通信内容は、商品 ASIN に対応する Sakura Checker の検索ページへの `GET` リクエストです。

- `https://sakura-checker.jp/search/<ASIN>/`

Amazon 側のページ本文やレビュー本文を Sakura Checker に送信することはありません。ASIN を使って該当ページを取得します。

### 保存する情報

`chrome.storage.local` に取得結果のキャッシュを保存します。

- キー: `score:<ASIN>`
- 保存内容: 取得時刻、Sakura Checker の参照 URL、評価画像情報、判定画像情報
- 保持期間: 12 時間

これは同じ商品を再表示したときの不要な再取得を減らすためのローカルキャッシュです。

取得時には、Sakura Checker の描画後 DOM を読むために `active: false` の一時タブを短時間だけ開いて、読み取り後すぐ閉じることがあります。

### 保存しない情報

この拡張は次の情報を保存しません。

- Amazon アカウント情報
- 閲覧履歴の一覧
- 入力フォームの内容
- 個人情報
- 広告識別子
- 解析イベントやトラッキングデータ

### 収集・販売・共有

- 開発者サーバーへの独自送信は行いません
- 収集したデータの販売は行いません
- 広告用途の共有は行いません
- ユーザー識別のための分析 SDK は含みません

### 拡張が要求する権限

`manifest.json` で要求している権限は次のとおりです。

- `storage`: Sakura Checker の取得結果を 12 時間キャッシュするため
- `tabs`: Sakura Checker の描画後 DOM を読むために、`active: false` の一時タブを短時間作成して閉じるため
- `scripting`: 一時タブ上の Sakura Checker ページへスクリプトを注入し、描画後の DOM を読み取るため
- `https://www.amazon.co.jp/*`: Amazon.co.jp の商品ページで拡張を動かし、ASIN を読み取って表示 UI を挿入するため
- `https://sakura-checker.jp/*`: Sakura Checker の商品ページを取得し、評価画像と判定情報を表示するため

### 制限事項

- Sakura Checker 側に対象商品がない場合は結果を表示できません
- Sakura Checker 側の HTML 構造が変わると解析に失敗する可能性があります
- `403`、`429`、タイムアウト時はエラー表示になります
- Amazon.co.jp 以外では動作しません

### 関連ドキュメント

- [プライバシーポリシー](./PRIVACY_POLICY.md)
- [ライセンス](./LICENSE)

### ストア説明欄に転記できる要約

この拡張は Amazon.co.jp の商品ページで ASIN を読み取り、Sakura Checker の公開ページを参照して評価画像を表示します。外部通信先は Sakura Checker のみです。個人情報、Amazon アカウント情報、入力内容、閲覧履歴一覧は収集しません。取得結果は再取得を減らすためにブラウザ内へ 12 時間キャッシュします。

## 開発者向け

### リポジトリ概要

このリポジトリは、Amazon 商品ページ上に Sakura Checker の結果を埋め込む Chrome 拡張を管理します。

- `content/`: ASIN 取得、表示 UI、Sakura Checker 連携のコンテンツスクリプト
- `background.js`: 一時タブ生成、描画後 DOM 読み取り、キャッシュ制御を行う service worker
- `tests/`: パーサー、API クライアント、コンテンツフロー、外部連携のテスト
- `scripts/`: zip 生成、manifest version 同期、E2E 実行補助スクリプト

### セットアップ

1. 依存関係をインストールします。

```bash
npm install
```

2. 初回にライブテストや E2E を動かす場合だけ、Playwright の Chromium をインストールします。

```bash
npx playwright install chromium
```

3. Chrome で `chrome://extensions/` を開きます。
4. デベロッパーモードを有効にします。
5. `パッケージ化されていない拡張機能を読み込む` からこのディレクトリを選びます。

### テスト

用途に応じて次のコマンドを使います。

- `npm test`: 安定した決定論的テスト。パーサー、描画済みスコア抽出、API クライアント、content-flow を検証します
- `npm run test:live`: Sakura Checker 実ページに対する rendered DOM のスモークテストです
- `npm run test:e2e-extension`: 実際の Amazon 商品ページを使う Playwright Chromium の拡張 E2E です
- `npm run test:deploy`: デプロイ前提の確認コマンドです。`npm test` と `npm run test:live` をまとめて実行します
- `npm run test:browser-compare`: ローカル調査用の opt-in テストです。通常の開発フローや GitHub Actions のデプロイゲートには含めません

`npm test` は繰り返し実行しても安定する前提のテストです。外部サイト依存の確認は `npm run test:live` と `npm run test:e2e-extension` で行います。

### パッケージング

Chrome Web Store 提出用 zip は次のコマンドで作成します。

```bash
npm run zip
```

`npm run zip` は `package.json` の version を `manifest.json` に同期したうえで、拡張の実行に必要なファイルだけを含む `extension.zip` をリポジトリ直下へ生成します。

### リリース

Chrome Web Store への提出と GitHub Actions を使った公開フローは [DEPLOYMENT.md](./DEPLOYMENT.md) にまとめています。

リリース前の最小チェック:

- `npm run test:deploy`
- `npm run zip`

### 関連ドキュメント

- [Chrome Web Store デプロイ手順](./DEPLOYMENT.md)
- [プライバシーポリシー](./PRIVACY_POLICY.md)
- [ライセンス](./LICENSE)
