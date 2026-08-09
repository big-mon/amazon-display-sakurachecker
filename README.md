# Amazon Display Sakura Checker

`Amazon Display Sakura Checker` は、Amazon.co.jp の商品ページ上に Sakura Checker の評価画像を表示する Chrome 拡張です。

Chrome Web Store での公開を前提に、利用者向けの権限・通信・保存データの扱いをまとめています。

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

商品 ASIN から評価情報を取得するため、検索結果に応じて Sakura Checker の次の公開経路を必要な場合に使用します。

- ASIN を Base64 エンコードした `https://sakura-checker.jp/itemsearch/?word=<Base64 ASIN>`
- 該当商品の詳細ページ `https://sakura-checker.jp/search/<ASIN>/`
- 商品を特定できない場合に Amazon 商品 URL を送信する検索フォーム

URL 検索後の結果に応じて詳細ページの取得や ASIN 検索の再試行を行うことがあります。

これらの情報を受け取る外部サービスは Sakura Checker だけです。Amazon 側のページ本文やレビュー本文は送信しません。

### 保存する情報

`chrome.storage.local` に取得結果のキャッシュを保存します。

- キー: `score:<ASIN>`
- 保存内容: 取得時刻、Sakura Checker の参照 URL、評価画像情報、判定画像情報
- キャッシュとして再利用する有効期間: 12 時間

これは同じ商品を再表示したときの不要な再取得を減らすためのローカルキャッシュです。期限切れの保存値は再利用されませんが、上書き、ブラウザデータの消去、または拡張機能の削除までローカルストレージに残る場合があります。

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

- `storage`: Sakura Checker の取得結果を最大 12 時間再利用するため
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

- [プライバシーポリシー](./PRIVACY_POLICY.md) — データアクセス、外部通信、保存に関する正本
- [ライセンス](./LICENSE)

### ストア説明欄に転記できる要約

以下はストア転記用の要約です。データの取扱いを変更するときは、正本である [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) と同時に更新します。

この拡張は Amazon.co.jp の商品ページで ASIN を読み取り、Sakura Checker の公開ページを参照して評価画像を表示します。外部通信先は Sakura Checker のみです。個人情報、Amazon アカウント情報、入力内容、閲覧履歴一覧は収集しません。取得結果は再取得を減らすためにブラウザ内で最大 12 時間再利用します。

## 開発・運用

- [AI エージェント向け開発・検証規約](./AGENTS.md)
- [Chrome Web Store のパッケージング・デプロイ手順](./DEPLOYMENT.md)
