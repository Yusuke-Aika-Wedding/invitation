# Yusuke & Aika Wedding Invitation

GitHub Pages + Google Apps Script + Googleスプレッドシートで動く、全ゲスト共通URLの結婚式Web招待状です。

## 公開URL

`https://Yusuke-Aika-Wedding.github.io/invitation/`

ゲストは初回だけ招待状に記載されたIDを入力します。IDはスプレッドシート「ゲスト一覧」のA列と照合され、認証後は同じブラウザ・同じ端末で再入力する必要がありません。

## 主な機能

- 全員共通の招待状URL
- A列のIDによる大文字・小文字を区別したゲスト認証・ゲスト名表示
- 認証済みIDの端末保存（Local Storage）
- 右上ハンバーガーメニュー
- 招待状ページ
- ゲスト一覧Y列で設定できる、ゲストごとの「Dear Guest」メッセージ
- スマホ・タブレット・PC対応のレスポンシブデザイン
- フェード表示、桜の花びら、5秒ごと・スワイプ操作の写真スライド
- 結婚式までのカウントダウン
- 会場リンク、Googleマップ、行き方動画
- 挙式・披露宴の出欠フォーム
- RSVP回答済みかつ披露宴に出席するゲストだけに表示される、全3問の「WEDDING PREDICTION」
- 質問ごとの投票率表示と、ゲストID単位の再投票防止
- 3問すべての投票後に完了メッセージを表示
- 専用シート「WEDDING PREDICTION」での投票結果管理
- 初期表示された氏名を編集して回答に反映
- アレルギー「あり／なし」必須選択と、「あり」の場合だけ表示される詳細欄
- GASによる回答保存、確認メール、リマインドメール、参加御礼メール

Y列「Dear Guestメッセージ」が空欄のゲストには、従来の共通メッセージを表示します。個別文が入力されている場合は、その文章と改行を優先して表示します。

## フォルダ構成

```text
invitation/
├─ index.html                 # 統一招待状ページ・ID入力画面
├─ 404.html                   # 統一URLへの戻り先
├─ css/style.css              # デザイン
├─ js/config.js               # GAS URL・挙式日時などの設定
├─ js/script.js               # ID認証・画面切替・フォーム送信
├─ assets/                    # 添付ZIPから引き継いだ写真・動画
├─ gas/Code.gs                # GAS本体
├─ gas/appsscript.json        # GAS設定
└─ docs/SETUP_GUIDE.md        # 導入・更新手順
```

## 公開前に必要な作業

1. `gas/Code.gs` と `gas/appsscript.json` をGoogle Apps Scriptへ貼り付ける。
2. GASで `setup` を1回実行する。
3. GASをウェブアプリとしてデプロイする。
4. 発行されたURLを `js/config.js` の `gasWebAppUrl` に貼り付ける。
5. このフォルダの中身をGitHubリポジトリへアップロードする。

詳しくは `docs/SETUP_GUIDE.md` を参照してください。
