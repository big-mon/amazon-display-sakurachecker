# Amazon Display Sakura Checker

`Amazon Display Sakura Checker` は、Amazon.co.jp の商品ページ上に Sakura Checker の評価画像を表示する Chrome 拡張です。

Chrome Web Store での公開を前提に、機能だけでなく、権限・通信・保存データの扱いをこの README に明記します。

## 関連ドキュメント

- [Chrome Web Store デプロイ手順](./DEPLOYMENT.md)
- [プライバシーポリシー](./PRIVACY_POLICY.md)
- [ライセンス](./LICENSE)

## 単一目的

この拡張の目的は 1 つです。

- Amazon.co.jp の商品ページで、対象商品の ASIN を取得する
- Sakura Checker の該当ページを参照する
- 取得できた評価画像と判定文を Amazon 商品ページ内に表示する

それ以外の用途には使いません。

## 利用者向けの透明性

### 何を読み取るか

この拡張は Amazon.co.jp の商品ページで次の情報だけを参照します。

- 商品ページ URL
- ページ内に含まれる ASIN

レビュー本文、購入履歴、氏名、住所、支払い情報、Amazon アカウント情報を読む実装はありません。

### どこに通信するか

外部通信先は次の 1 つです。

- [Sakura Checker](https://sakura-checker.jp/)

通信内容は、商品 ASIN に対応する Sakura Checker の検索ページへの `GET` リクエストです。

実際の参照先:

- `https://sakura-checker.jp/search/<ASIN>/`

現在の実装では、Amazon 側のページ本文やレビュー本文は Sakura Checker に送信しません。ASIN を使って該当ページを取得します。

### 何を保存するか

`chrome.storage.local` に、取得結果のキャッシュを保存します。

- キー: `score:<ASIN>`
- 保存内容: 取得時刻、Sakura Checker の参照 URL、評価画像情報、判定画像情報
- 保持期間: 12 時間

これは同じ商品を再表示したときの不要な再取得を減らすためのローカルキャッシュです。

### 何を保存しないか

この拡張は次の情報を保存しません。

- Amazon アカウント情報
- 閲覧履歴の一覧
- 入力フォームの内容
- 個人情報
- 広告識別子
- 解析イベントやトラッキングデータ

### 収集・販売・共有について

- 開発者サーバーへの独自送信は行いません
- 収集したデータの販売は行いません
- 広告用途の共有は行いません
- ユーザー識別のための分析 SDK は含みません

## Chrome 拡張の権限

`manifest.json` で要求している権限は次のとおりです。

### `storage`

用途:

- Sakura Checker の取得結果を 12 時間キャッシュするため

### `https://www.amazon.co.jp/*`

用途:

- Amazon.co.jp の商品ページでコンテンツスクリプトを動かすため
- 商品ページ URL と ASIN を読み取るため
- 商品ページ内に評価表示 UI を挿入するため

### `https://sakura-checker.jp/*`

用途:

- Sakura Checker の商品ページを取得するため
- 評価画像と判定情報を表示するため

## 画面上で行うこと

Amazon.co.jp の商品ページで、商品タイトル周辺の領域に表示ブロックを追加します。

- 読み込み中表示
- Sakura Checker の評価画像
- 判定画像と判定文
- Sakura Checker の元ページへのリンク

ページ外への自動投稿、レビュー投稿、クリック代行は行いません。

## 制限事項

- Sakura Checker 側に対象商品がない場合は結果を表示できません
- Sakura Checker 側の HTML 構造が変わると解析に失敗する可能性があります
- `403`、`429`、タイムアウト時はエラー表示になります
- Amazon.co.jp 以外では動作しません

## 開発

### ローカルで読み込む

1. Chrome で `chrome://extensions/` を開く
2. デベロッパーモードを有効にする
3. `パッケージ化されていない拡張機能を読み込む` からこのディレクトリを選ぶ

### テスト

```bash
npm test
```

実行対象:

- HTML 解析ロジックの単体テスト
- API クライアントのテスト
- 結合テスト
- ブラウザ比較テスト

## 公開時に説明欄へ転記できる要約

この拡張は Amazon.co.jp の商品ページで ASIN を読み取り、Sakura Checker の公開ページを参照して評価画像を表示します。外部通信先は Sakura Checker のみです。個人情報、Amazon アカウント情報、入力内容、閲覧履歴一覧は収集しません。取得結果は再取得を減らすためにブラウザ内へ 12 時間キャッシュします。

## ライセンス

MIT
