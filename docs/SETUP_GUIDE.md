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

使用するのはA〜M列です。旧構成のL列に `招待状URL` がある場合、`setup` の実行時にその列だけを削除し、M・N列の既存データをL・M列へ移動します。

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

招待状URLは各行へ保存せず、GASの `baseInvitationUrl` をメール送信時に使用します。`setup` は旧招待状URL列の移行と、自動メール用トリガーの設定を行います。

確認メール、1週間前リマインド、前日リマインド、参加ありがとうメールは、`APP_CONFIG.senderEmail` に設定したアドレスを送信元とし、すべて `APP_CONFIG.bccEmail` に設定したアドレスへBCCでも送信します。

現在の送信元・BCCは、どちらも `yusuke.aika.wedding@gmail.com` です。Gmailの送信エイリアスは使用しません。ウェブアプリと自動トリガーを専用アカウントの権限で実行することで、このアドレスが実際の送信元になります。

受信者が返信すると、`APP_CONFIG.senderEmail` に設定した送信元へ届きます。そのため、返信不可の注意書きは記載していません。

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

旧GASのURLを使い続けると旧アカウントで処理されるため、`js/config.js` のURL更新は必須です。新URLで動作確認が完了した後、旧アカウントのGASプロジェクトを開き、リマインド・参加御礼の時間主導トリガーを削除してください。旧トリガーを残すと、新旧両方のアカウントからメールが送信される可能性があります。

特定ゲストの内容で、回答確認・1週間前・前日・参加御礼の4種類の自動メールを確認したい場合は、GASエディタから `sendRequestedEmailPreviews` を実行します。ID `sfm549Eys` の内容が `APP_CONFIG.previewRecipientEmail`（`yusuke.tigers.0522@gmail.com`）へ送信され、確認用メールの送信日時はスプレッドシートへ記録されません。

確認メールの送信元が `yusuke.aika.wedding@gmail.com`、宛先が `yusuke.tigers.0522@gmail.com`、BCCが `yusuke.aika.wedding@gmail.com` になっていることを確認してください。

## 7. 動作確認

1. 共通URLをシークレットウィンドウで開く。
2. スプレッドシートA列にあるIDを入力する。
3. B列のゲスト名が表示されることを確認する。
4. 一度ページを閉じ、同じブラウザで再度開く。
5. ID入力が省略されることを確認する。
6. アレルギーの「あり」を選ぶと詳細欄が現れ、「なし」を選ぶと消えることを確認する。
7. 必要に応じて氏名を編集し、出欠を送信してB〜M列と確認メールを確認する。
8. ハンバーガーメニューから「招待状ページ」「2人の紹介ページ」を開く。
9. GASの `トリガー` 画面で、`sendReminderEmails` と `sendAfterReceptionThanksEmails` の所有者が専用アカウントであることを確認する。

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
- 「2人の紹介ページ」は、現在は意図的に白紙です。
