# Yusuke & Aika Wedding Invitation セットアップ手順

このプロジェクトは、GitHub Pages + Google Apps Script + Googleスプレッドシートで動く、全ゲスト共通URLの結婚式Web招待状です。

## 0. 設定済みの情報

- GitHubユーザー名：`Yusuke-Aika-Wedding`
- リポジトリ名：`invitation`
- 公開URL：`https://Yusuke-Aika-Wedding.github.io/invitation/`
- スプレッドシートID：`1micDJFsf6ktwZrq_tlIz9TiC4PjbBbv-7dlWgbhMjbs`
- シート名：`ゲスト一覧`
- ID列：A列（見出しは `ID`）

## 1. GitHubへアップロード

1. ZIPを解凍する。
2. `invitation` フォルダを開く。
3. GitHubで `Yusuke-Aika-Wedding / invitation` リポジトリを開く。
4. `Add file` → `Upload files` を選ぶ。
5. `invitation` フォルダの「中身」をすべてドラッグ＆ドロップする。
6. `Commit changes` を押す。

旧版の `sfm549Eys` フォルダがGitHubに残っている場合は削除してください。以後はゲストごとのフォルダを作りません。

## 2. GitHub Pagesを有効化

1. リポジトリの `Settings` を開く。
2. 左メニューの `Pages` を開く。
3. `Build and deployment` の `Source` を `Deploy from a branch` にする。
4. `Branch` を `main`、フォルダを `/root` にする。
5. `Save` を押す。
6. 数分後、次のURLを開く。
   `https://Yusuke-Aika-Wedding.github.io/invitation/`

## 3. 専用アカウントでGoogle Apps Scriptを設定

メール送信元を確実に `yusuke.aika.wedding@gmail.com` にするため、スプレッドシートの所有者だけでなく、GASの実行・デプロイ・トリガー作成もこの専用アカウントで行います。

### 3-1. スプレッドシートを専用アカウントから利用できるようにする

既存の回答データをそのまま使う場合は、スプレッドシートをコピーせず、現在のスプレッドシートを共有する方法がおすすめです。

1. 現在のスプレッドシートを開く。
2. 右上の `共有` を押す。
3. `yusuke.aika.wedding@gmail.com` を追加する。
4. 権限を `編集者` にして共有する。
5. `yusuke.aika.wedding@gmail.com` でスプレッドシートを開けることを確認する。

所有権を移行できる場合は移行しても構いません。スプレッドシートをコピーする場合は、回答データが二重管理にならないよう旧シートの使用を停止し、新しいスプレッドシートIDを `gas/Code.gs` の `APP_CONFIG.spreadsheetId` に設定してください。

### 3-2. 専用アカウントでGASプロジェクトを作成する

1. ブラウザ右上のGoogleアカウントを確認し、`yusuke.aika.wedding@gmail.com` に切り替える。
2. Googleドライブで `新規` → `その他` → `Google Apps Script` を開く。
3. プロジェクト名を `Yusuke & Aika Wedding Invitation` に変更する。
4. `gas/Code.gs` の内容を、GASの `Code.gs` にすべて貼り付ける。
5. `gas/appsscript.json` の内容を、GASの `appsscript.json` にすべて貼り付ける。
6. 保存する。

`appsscript.json` が見えない場合は、GAS左側の歯車から「appsscript.json マニフェスト ファイルをエディタで表示する」をONにします。

コードには実行アカウントの安全チェックがあります。`yusuke.aika.wedding@gmail.com` 以外のアカウントで `setup` またはメール送信を実行すると、処理を停止してエラーを表示します。

## 4. 初期設定を1回実行

1. GAS右上のGoogleアカウントが `yusuke.aika.wedding@gmail.com` であることを確認する。
2. GAS上部の関数選択で `setup` を選ぶ。
3. `実行` を押す。
4. 初回の権限確認を承認する。
5. 実行ログに `Setup complete.` と表示されることを確認する。

使用するのはA〜Y列です。旧構成のL列に `招待状URL` がある場合、`setup` の実行時にその列だけを削除し、M・N列の既存データをL・M列へ移動します。

| 列 | 内容 |
|---|---|
| A | ID |
| B | ゲスト名 |
| C | メールアドレス |
| D | 挙式出欠 |
| E | 披露宴出欠 |
| F | アレルギー（なし、または詳細） |
| G | 回答日時 |
| H | 確認メール送信日時 |
| I | 1週間前リマインド送信日時 |
| J | 前日リマインド送信日時 |
| K | 更新日時 |
| L | メッセージ |
| M | 参加ありがとうメール送信日時 |
| N | ご祝儀ステータス |
| O | 送金方法 |
| P | 送金元名義 |
| Q | 送金についてのメモ |
| R | 送金申告日時 |
| S | 送金申告通知メール送信日時 |
| T | 着金確認日時 |
| U | 着金確認メール送信日時 |
| V | 要確認メール送信日時 |
| W | メール操作 |
| X | ご祝儀管理メモ |
| Y | Dear Guestメッセージ |

Y列が空欄の場合は、従来の共通「Dear Guest」メッセージを表示します。ゲストごとの文章を入力すると、その文章とセル内改行が優先して表示されます。

N〜X列は過去のご祝儀機能の記録を壊さないため保持しています。現在の招待状ページには「ご祝儀について」を表示しません。

`setup` は専用シート「WEDDING PREDICTION」も作成します。このシートは次のA〜G列で、1ゲスト・1質問につき1行の投票を管理します。

| 列 | 内容 |
|---|---|
| A | ID |
| B | ゲスト名 |
| C | 質問ID |
| D | 質問 |
| E | 投票 |
| F | 正解 |
| G | 投票日時 |

投票はRSVP回答済みかつ披露宴に出席するゲストだけ受け付けます。同じID・同じ質問の行がすでにある場合は新しい行を追加せず、最初の投票を返すため、端末やブラウザを変えても再投票できません。

## 5. GASをウェブアプリとしてデプロイ

1. GAS右上のGoogleアカウントが `yusuke.aika.wedding@gmail.com` であることを確認する。
2. GAS右上の `デプロイ` → `新しいデプロイ` を押す。
3. 種類は `ウェブアプリ` を選ぶ。
4. 実行ユーザー：`自分（yusuke.aika.wedding@gmail.com）`
5. アクセスできるユーザー：`全員`
6. `デプロイ` を押す。
7. 表示された `/exec` で終わるウェブアプリURLをコピーする。

ここで `実行ユーザー` が旧アカウントの場合はデプロイせず、専用アカウントへ切り替えてGASプロジェクトを開き直してください。

コードを後から変更した場合は、`デプロイ` → `デプロイを管理` → 鉛筆マーク → `新バージョン` → `デプロイ` の順に更新します。

## 6. GitHub側へGAS URLを設定

`js/config.js` の次の値を、手順5でコピーしたURLに置き換えます。

```js
gasWebAppUrl: 'PASTE_YOUR_GAS_WEB_APP_URL_HERE',
```

変更後、GitHubへ再アップロードしてCommitします。

旧GASのURLを使い続けると旧アカウントで処理されるため、`js/config.js` のURL更新は必須です。新URLで動作確認が完了した後、旧アカウントのGASプロジェクトを開き、リマインド・参加御礼・送金申告通知再送・メール操作の各トリガーを削除してください。旧トリガーを残すと、新旧両方のアカウントからメールが送信される可能性があります。

特定ゲストの内容で、回答確認・1週間前・前日・参加御礼の4種類の自動メールを確認したい場合は、GASエディタから `sendRequestedEmailPreviews` を実行します。ID `sfm549Eys` の内容が `APP_CONFIG.previewRecipientEmail`（`yusuke.tigers.0522@gmail.com`）へ送信され、確認用メールの送信日時はスプレッドシートへ記録されません。

確認メールの送信元が `yusuke.aika.wedding@gmail.com`、宛先が `yusuke.tigers.0522@gmail.com`、BCCが `yusuke.aika.wedding@gmail.com` になっていることを確認してください。

## 7. 動作確認

1. 共通URLをシークレットウィンドウで開く。
2. スプレッドシートA列にあるIDを入力する。
3. B列のゲスト名が表示されることを確認する。
4. 一度ページを閉じ、同じブラウザで再度開く。
5. ID入力が省略されることを確認する。
6. アレルギーの「あり」を選ぶと詳細欄が現れ、「なし」を選ぶと消えることを確認する。
7. 必要に応じて氏名を編集し、出欠を送信してB〜Y列と確認メールを確認する。
8. RSVPで披露宴を「出席」と回答した場合だけ「WEDDING PREDICTION」が表示され、「欠席」の場合は表示されないことを確認する。
9. 3問それぞれで選択肢を選び、「この内容で投票する」を押す。
10. 投票後に各選択肢の割合が%で表示され、専用シートへ1行追加されることを確認する。
11. ページを再読込し、投票済みの質問に投票ボタンが表示されないことを確認する。
12. 3問すべてへ投票すると、最下部に「投票ありがとうございます！当日お楽しみに！」と表示されることを確認する。
13. Y列へ個別文とセル内改行を入力し、再読込後の「Dear Guest」に反映されることを確認する。確認後は必要な文章または空欄へ戻す。

IDを入れ直す場合は、ハンバーガーメニュー下部の「IDを変更する」を押します。

## 8. 写真・動画

- ID入力画面・最初のメッセージ：`assets/gallery-1.jpg`
- 招待状上部スライド：`assets/gallery-2.jpg`、`gallery-3.jpg`、`gallery-4.jpg`
- 会場までの行き方動画：`assets/access-placeholder.mp4`

添付ZIPの写真をそのまま引き継いでいます。行き方動画を差し替える場合は、同じファイル名で置き換えてください。

## 9. 補足

- ID保存はブラウザのLocal Storageを使います。別端末、別ブラウザ、シークレットモードでは再入力が必要です。
- A列のIDは同一の文字列で重複させないでください。
- ID照合では大文字・小文字を区別します。たとえば `GuestA` と `guesta` は別のIDです。
- ID認証が必要なため、GAS URL設定前は招待状本文を開けません。
- WEDDING PREDICTIONの正解は投票画面には表示せず、専用シートのF列で管理します。
