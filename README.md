# Japan News Shorts Studio MVP

毎日「日本の主要ニュースを英語で紹介するYouTube Shorts」を作るためのローカルMVPです。ニュース候補選択、英語台本、録音/アップロード、字幕生成、背景素材フォールバック、FFmpeg動画生成、履歴表示までを一通りつなげています。

## 1. 必要なソフトウェア

- Node.js 24以上
- npm
- FFmpeg

このMVPはNode.js組み込みのSQLite機能を使います。外部AI、ニュースAPI、ストック素材APIがなくてもモックデータで動きます。

## 2. インストール方法

```powershell
npm.cmd install
```

PowerShellで`npm`が実行ポリシーに止められる場合は、`npm.cmd`を使ってください。

## 3. FFmpegのセットアップ

FFmpegをインストールし、`ffmpeg`コマンドがPATHから呼べるようにしてください。別の場所にある場合は`.env`で指定します。

```text
FFMPEG_PATH=C:\path\to\ffmpeg.exe
```

未導入の場合でもアプリは起動しますが、動画生成時に分かるエラーを表示します。

## 4. 環境変数

`.env.example`をコピーして`.env`を作ります。

```text
AI_PROVIDER=mock
NEWS_PROVIDER=mock
STOCK_MEDIA_PROVIDER=mock
YOUTUBE_UPLOAD_ENABLED=false
APP_TIMEZONE=Asia/Tokyo
DAILY_NEWS_REFRESH_TIME=07:00
FFMPEG_PATH=ffmpeg
```

APIキーはソースコードに書かないでください。YouTube投稿は初期状態では無効です。

## 5. データベース初期化

```powershell
npm.cmd run db:init
```

SQLite DBは`data/app.db`に作成されます。

## 6. 開発サーバー起動

```powershell
npm.cmd run dev
```

ブラウザで表示されたローカルURLを開きます。

## 7. 動画生成のテスト方法

1. ニュース候補から1件を選択
2. 生成された英語台本を確認して保存
3. ブラウザで録音、または音声ファイルをアップロード
4. 「文字起こしと字幕生成」を実行
5. 「背景素材を準備」を実行
6. 「動画生成」を実行
7. 完成動画をプレビューし、MP4をダウンロード

APIキーなしの文字起こしは、実際の音声解析ではなく台本を基準にしたMVP用の擬似トランスクリプトです。

## 8. よくあるエラー

- `FFmpeg was not found`: FFmpegをインストールするか、`.env`の`FFMPEG_PATH`を設定してください。
- 音声アップロード失敗: MP3、WAV、M4A、WebMなど30MB以下の音声を使ってください。
- npmが実行できない: Windows PowerShellでは`npm.cmd`を使ってください。
- SQLite関連エラー: Node.js 24以上で実行してください。

## 外部サービスなしで試す方法

`.env`を作らなくてもモックニュース、ローカル生成背景、台本ベース字幕で試せます。動画生成だけはFFmpegが必要です。

## 必要な外部サービス一覧

本番化で検討するもの:

- ニュース取得: 公式RSS、信頼できるニュースAPI、官公庁の公開フィード
- AI台本生成: OpenAIなどのLLM API
- 文字起こし: Whisper系APIまたはローカルASR
- ストック素材: Pexels、Pixabayなど商用利用条件を確認できるAPI
- YouTube投稿: YouTube Data API

## 本番環境へ移行する際の注意事項

- ニュース記事の全文保存や転載を避け、出典URLと短い要約だけを保存してください。
- 台本生成では、日付、人数、金額、固有名詞を複数ソースで確認してください。
- 権利不明の報道動画やSNS動画を背景素材に使わないでください。
- SQLiteからPostgreSQLへ移行する場合は、`lib/db.ts`のDBアクセス関数を差し替えてください。
- 動画生成は長くなりやすいため、本番ではキュー付きワーカーへ分離してください。
- YouTube投稿は必ず非公開または限定公開を初期値にし、ユーザー確認なしで公開しないでください。

## 今後の拡張候補

- 公式RSS/APIからのニュース取得
- 複数ソース照合と矛盾検出
- Whisperによる単語単位タイムスタンプ
- ストック素材API連携
- BGM挿入
- YouTube非公開アップロード
- PostgreSQL対応
- 毎朝7時の自動ニュース更新ジョブ
