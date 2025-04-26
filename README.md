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
    console.log(`処理リクエスト受信: action=${action}, パラメータ:`, params);
    
    switch(action) {
      case 'getUserData':
        console.log(`getUserDataアクション実行: guildId=${params.guildId}, userId=${params.userId}`);
        result = getUserData(ss, params.guildId, params.userId);
        break;
      case 'saveUserData':
        console.log(`saveUserDataアクション実行: `, params.userData);
        result = saveUserData(ss, JSON.parse(params.userData));
        break;
      case 'getServerRanking':
        console.log(`getServerRankingアクション実行: guildId=${params.guildId}, limit=${params.limit}`);
        result = getServerRanking(ss, params.guildId, params.limit);
        break;
      case 'logEventParticipation':
        console.log(`logEventParticipationアクション実行: guildId=${params.guildId}, userId=${params.userId}, eventName=${params.eventName}`);
        result = logEventParticipation(ss, params.guildId, params.userId, params.eventName, params.bonusPoints);
        break;
      case 'logPointsHistory':
        console.log(`logPointsHistoryアクション実行: guildId=${params.guildId}, userId=${params.userId}, points=${params.points}, reason=${params.reason}`);
        result = logPointsHistory(ss, params.guildId, params.userId, params.points, params.reason);
        console.log(`logPointsHistory実行結果:`, result);
        break;
      default:
        console.error(`未知のアクション: ${action}`);
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

function logPointsHistory(ss, guildId, userId, points, reason) {
  try {
    console.log(`logPointsHistory実行: guildId=${guildId}, userId=${userId}, points=${points}, reason=${reason}`);
    
    // PointsHistoryシートが存在するか確認
    let sheet = ss.getSheetByName('PointsHistory');
    if (!sheet) {
      console.log('PointsHistoryシートが存在しないため作成します');
      sheet = ss.insertSheet('PointsHistory');
      sheet.appendRow(['timestamp', 'guildId', 'userId', 'points', 'reason']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
    const timestamp = new Date().toISOString();
    console.log(`ポイント履歴を記録します: timestamp=${timestamp}`);
    
    sheet.appendRow([
      timestamp,
      guildId,
      userId,
      parseInt(points),
      reason
    ]);
    
    const result = {
      timestamp,
      guildId,
      userId,
      points: parseInt(points),
      reason
    };
    
    console.log('ポイント履歴記録成功:', result);
    return result;
  } catch (error) {
    console.error('ポイント履歴の記録中にエラーが発生しました:', error);
    throw error;
  }
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

### 環境変数の設定手順

1. Render ダッシュボードでデプロイしたサービスを選択します
2. 左側のメニューから「Environment」をクリックします
3. 「Environment Variables」セクションで以下の環境変数を設定します：
   - `DISCORD_TOKEN` - Discord Bot のトークン
   - `DISCORD_CLIENT_ID` - Discord アプリケーションのクライアント ID
   - `GOOGLE_SHEETS_API_KEY` - Google Sheets API キー
   - `GOOGLE_SHEETS_ID` - 使用する Google スプレッドシートの ID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` - サービスアカウントのメールアドレス
   - `GOOGLE_PRIVATE_KEY` - サービスアカウントの秘密鍵（引用符「"」を含む完全な形式で入力）
   - `NODE_ENV` - `production` に設定
   - `PORT` - `3000` に設定（Render の Web サービスではデフォルトのポート）
   - `SERVER_URL` - デプロイされた Web サービスの URL（例: `https://your-app-name.onrender.com`）
   - `DAILY_MESSAGE_POINT` - 日々のメッセージに付与するポイント（例: 1）
   - `CONSECUTIVE_BONUS_DAYS` - 連続投稿ボーナスの日数（例: 10）
   - `CONSECUTIVE_BONUS_POINTS` - 連続投稿ボーナスのポイント（例: 10）
4. 「Save Changes」ボタンをクリックして保存します
5. 環境変数を設定後、「Manual Deploy」→「Clear build cache & deploy」をクリックして再デプロイします

**注意**: GOOGLE_PRIVATE_KEY の設定時には、改行を含む完全な形式のキーを入力する必要があります。Render の環境変数エディタでは、複数行のテキストを入力できます。

### Render のスリープ対策

Render の無料プランでは、15 分間アクセスがないとサービスがスリープ状態になります。これを防ぐために、以下の対策が実装されています：

1. 自己 Ping 機能：Bot は 14 分ごとに自身の Web サービスに HTTP リクエストを送信してスリープを防止します
2. 設定方法：
   - `SERVER_URL` 環境変数に、Render にデプロイした Web サービスの URL を設定します
   - 例: `https://your-discord-bot.onrender.com`
3. 確認方法：
   - Render ダッシュボードの「Logs」セクションで、定期的に `Self-ping successful` というログが表示されていれば正常に動作しています

この機能により、Bot は常時稼働状態を維持できます。

## ライセンス

MIT

## サポート

問題や質問がある場合は、GitHub Issues でお問い合わせください。 