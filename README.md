# Discord ポイントシステムボット

Discord サーバー内でのユーザーの活動（メッセージ送信）に基づいてポイントを付与するボットです。連続投稿に対するボーナスやイベント参加に対するボーナスなどの機能を備えています。

## 主な機能

- 毎日のメッセージ投稿に対するポイント付与
- 連続投稿に対するボーナスポイント
- 連続が途切れた場合のポイントリセット
- イベント参加に対するボーナスポイント
- ポイント変動時の DM 通知
- ポイント確認コマンド
- サーバー内ランキング表示
- 管理者用ポイント手動調整機能

## 技術スタック

- Node.js v18.x
- Discord.js v14.x
- Google Sheets API v4（データ保存）
- Google App Script（将来的なポイント制度変更用）
- Render（ホスティング）

## セットアップ手順

### 前提条件

- Node.js v18.x 以上
- npm または yarn
- Discord Developer Portal のアカウント
- Google アカウント

### インストール

1. リポジトリをクローン
   ```bash
   git clone https://github.com/yourusername/discord-point-bot.git
   cd discord-point-bot
   ```

2. 依存パッケージをインストール
   ```bash
   npm install
   ```

3. 環境変数の設定
   ```bash
   cp env.example .env
   ```
   `.env` ファイルを編集して、必要な情報を入力してください。

### Discord Bot の設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックして新しいアプリケーションを作成
3. 「Bot」タブで新しいボットを作成
4. 「Reset Token」をクリックしてトークンを取得し、`.env` ファイルの `DISCORD_TOKEN` に設定
5. 「OAuth2」タブで「CLIENT ID」をコピーし、`.env` ファイルの `DISCORD_CLIENT_ID` に設定
6. 「Privileged Gateway Intents」セクションで以下のインテントを有効化：
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT

### Google Sheets と Google Apps Script の設定

1. Google Driveで新しいスプレッドシートを作成し、以下のシートを追加：
   - `UserData`（列：guildId, userId, username, points, lastActiveDate, consecutiveDays, joinDate）
   - `EventHistory`（列：timestamp, guildId, userId, eventName, bonusPoints）
   - `PointsHistory`（列：timestamp, guildId, userId, points, reason）

2. スプレッドシートの「拡張機能」メニューから「Apps Script」をクリックして、Google Apps Scriptエディタを開きます

3. スクリプトエディタで以下のコードを入力します：

```javascript
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter;
  const action = params.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let result = {};
  
  try {
    switch(action) {
      case 'getUserData':
        result = getUserData(ss, params.guildId, params.userId);
        break;
      case 'saveUserData':
        result = saveUserData(ss, JSON.parse(params.userData));
        break;
      case 'getServerRanking':
        result = getServerRanking(ss, params.guildId, params.limit);
        break;
      case 'logEventParticipation':
        result = logEventParticipation(ss, params.guildId, params.userId, params.eventName, params.bonusPoints);
        break;
      default:
        throw new Error('Unknown action');
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUserData(ss, guildId, userId) {
  // UserDataシートからユーザーデータを取得するロジック
  const sheet = ss.getSheetByName('UserData');
  const data = sheet.getDataRange().getValues();
  
  // ヘッダー行を除外
  const headers = data[0];
  const rows = data.slice(1);
  
  // ユーザーを検索
  const userRow = rows.find(row => row[0] === guildId && row[1] === userId);
  
  if (!userRow) {
    return null;
  }
  
  // データを構造化して返す
  return {
    guildId: userRow[0],
    userId: userRow[1],
    username: userRow[2],
    points: parseInt(userRow[3]) || 0,
    lastActiveDate: userRow[4],
    consecutiveDays: parseInt(userRow[5]) || 0,
    joinDate: userRow[6] || new Date().toISOString().split('T')[0]
  };
}

function saveUserData(ss, userData) {
  // 既存のユーザーデータを確認
  const existingData = getUserData(ss, userData.guildId, userData.userId);
  const sheet = ss.getSheetByName('UserData');
  
  if (existingData) {
    // 既存ユーザーの更新
    const data = sheet.getDataRange().getValues();
    // ユーザーのインデックスを検索
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userData.guildId && data[i][1] === userData.userId) {
        rowIndex = i + 1; // シートの行は1から始まる
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error('更新対象のユーザーが見つかりませんでした');
    }
    
    // データを更新
    sheet.getRange(rowIndex, 1, 1, 7).setValues([[
      userData.guildId,
      userData.userId,
      userData.username,
      userData.points,
      userData.lastActiveDate,
      userData.consecutiveDays,
      userData.joinDate || ''
    ]]);
    
  } else {
    // 新規ユーザーの追加
    sheet.appendRow([
      userData.guildId,
      userData.userId,
      userData.username,
      userData.points,
      userData.lastActiveDate,
      userData.consecutiveDays,
      userData.joinDate || new Date().toISOString().split('T')[0]
    ]);
  }
  
  return userData;
}

function getServerRanking(ss, guildId, limit = 10) {
  const sheet = ss.getSheetByName('UserData');
  const data = sheet.getDataRange().getValues();
  
  // ヘッダー行を除外
  const rows = data.slice(1);
  
  // 指定のサーバーIDのデータのみをフィルタリング
  const serverUsers = rows.filter(row => row[0] === guildId);
  
  // ポイントでソート
  serverUsers.sort((a, b) => (parseInt(b[3]) || 0) - (parseInt(a[3]) || 0));
  
  // 上位N件のみを返す
  return serverUsers.slice(0, limit).map((user, index) => ({
    rank: index + 1,
    userId: user[1],
    username: user[2],
    points: parseInt(user[3]) || 0
  }));
}

function logEventParticipation(ss, guildId, userId, eventName, bonusPoints) {
  const sheet = ss.getSheetByName('EventHistory');
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([
    timestamp,
    guildId,
    userId,
    eventName,
    parseInt(bonusPoints)
  ]);
  
  return {
    timestamp,
    guildId,
    userId,
    eventName,
    bonusPoints: parseInt(bonusPoints)
  };
}
```

4. 「デプロイ」ボタンをクリックして、ウェブアプリとしてデプロイします
   - デプロイタイプ：「ウェブアプリ」
   - 次のユーザーとして実行：「自分（あなたのメールアドレス）」
   - アプセスできるユーザー：「全員」
   - デプロイをクリックし、アクセス権を承認

5. デプロイ後に表示されるウェブアプリのURLをコピーし、`.env` ファイルの `GOOGLE_SHEETS_API_URL` として保存します

6. スプレッドシートIDを `.env` ファイルの `GOOGLE_SHEETS_ID` に設定します

7. スプレッドシートを以下のユーザーと共有します：
   - ボットを実行するアカウント（編集者として）

### コマンドの登録

```bash
node src/deploy-commands.js
```

### ボットの起動

```bash
npm start
```

開発モードで起動（変更を監視）：

```bash
npm run dev
```

## コマンド一覧

### 一般ユーザー向け

- `/points` - 自分のポイント情報を確認
- `/ranking [limit]` - サーバー内のポイントランキングを表示

### 管理者向け

- `/admin-points <user> <points> [reason]` - ユーザーにポイントを手動で付与/減算
- `/event-bonus <user> <points> <event>` - イベント参加でボーナスポイントを付与

## Render へのデプロイ

1. Render アカウントを作成
2. 「New Web Service」をクリック
3. GitHub リポジトリに連携
4. 以下の設定で Web サービスを作成：
   - Name: discord-point-bot（任意）
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node src/index.js`
   - 環境変数に `.env` ファイルの内容を設定

## ライセンス

MIT

## サポート

問題や質問がある場合は、GitHub Issues でお問い合わせください。 