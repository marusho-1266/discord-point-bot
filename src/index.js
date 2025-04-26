// Discord Bot のメインエントリーポイント
const { Client, Events, GatewayIntentBits, Collection, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config();

// ボット起動のログを追加
console.log('Discord Pointボットを起動しています...');
console.log('環境変数の確認:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID}`);
console.log(`- GOOGLE_SHEETS_API_URL: ${process.env.GOOGLE_SHEETS_API_URL ? '設定済み' : '未設定'}`);

// Renderのスリープ防止用の自己Pingサーバー
function setupKeepAliveServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord Point Bot is alive!');
  });
  
  server.listen(process.env.PORT || 3000, () => {
    console.log(`Keep-alive server running on port ${process.env.PORT || 3000}`);
  });
  
  // 15分(900000ms)ごとに自己Pingを実行
  setInterval(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Performing self-ping to prevent sleep...`);
    
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    http.get(serverUrl, (res) => {
      console.log(`[${timestamp}] Self-ping successful, status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`[${timestamp}] Self-ping failed:`, err);
    });
  }, 840000); // 14分ごとに実行（15分の制限より少し短く）
}

// Renderの場合は自己Pingサーバーをセットアップ
if (process.env.NODE_ENV === 'production') {
  setupKeepAliveServer();
  console.log('Keep-alive mechanism has been setup for production environment');
}

// Discordクライアントの作成と必要なインテントの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel, // DMチャンネルのために必要
    Partials.GuildMember,
    Partials.User,
    Partials.Reaction
  ]
});

// コマンドコレクションの初期化
client.commands = new Collection();

// イベントハンドラの読み込み
console.log('イベントハンドラを読み込んでいます...');
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log(`利用可能なイベントファイル: ${eventFiles.join(', ')}`);

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  
  console.log(`イベント登録: ${event.name} (${file})`);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
    console.log(`- onceイベントとして登録: ${event.name}`);
  } else {
    client.on(event.name, (...args) => event.execute(...args));
    console.log(`- 通常イベントとして登録: ${event.name}`);
  }
}

// コマンドハンドラの読み込み
console.log('コマンドハンドラを読み込んでいます...');
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(`利用可能なコマンドファイル: ${commandFiles.join(', ')}`);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`コマンド登録: ${command.data.name} (${file})`);
  } else {
    console.log(`[WARNING] ${filePath} のコマンドには必要な "data" または "execute" プロパティがありません。`);
  }
}

// クライアント準備完了イベントのログ
client.on(Events.ClientReady, () => {
  console.log(`[READY] ログインしました: ${client.user.tag}`);
  console.log(`サーバー数: ${client.guilds.cache.size}`);
  client.guilds.cache.forEach(guild => {
    console.log(`- ${guild.name} (${guild.id}): ${guild.memberCount}メンバー`);
  });
});

// メッセージイベントのデバッグ用リスナー
client.on('messageCreate', (message) => {
  console.log(`[DEBUG] メッセージ受信: ${message.content.substring(0, 20)}... (${message.author.tag})`);
});

// Discordにログイン
client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log('Discord APIにログインしました');
  })
  .catch(error => {
    console.error('Discord への接続中にエラーが発生しました:', error);
    process.exit(1);
  });

// プロセスの未処理の例外をキャッチ
process.on('unhandledRejection', error => {
  console.error('未処理の例外:', error);
}); 