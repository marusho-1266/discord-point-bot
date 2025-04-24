const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const { config } = require('dotenv');
const path = require('path');

// 環境変数の読み込み
config();

// Discordクライアントの初期化
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS
  ]
});

// コマンドコレクションの初期化
client.commands = new Collection();

// コマンドファイルの読み込み
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // コマンドデータとハンドラーを登録
  if ('data' in command && 'handleRequest' in command) {
    client.commands.set(command.data.name, command);
    console.log(`コマンド ${command.data.name} を登録しました`);
  } else {
    console.warn(`${filePath} に必要なプロパティがありません`);
  }
}

// クライアントの準備完了時
client.once('ready', () => {
  console.log(`${client.user.tag} が起動しました！`);
});

// スラッシュコマンドの処理
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  
  if (!command) return;
  
  try {
    await command.handleRequest(interaction);
  } catch (error) {
    console.error(`コマンド ${interaction.commandName} の実行中にエラーが発生しました:`, error);
    
    // エラー応答
    try {
      const errorMessage = { 
        content: 'コマンドの実行中にエラーが発生しました', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (e) {
      console.error('エラー応答中に追加のエラーが発生しました:', e);
    }
  }
});

// ボットのログイン
client.login(process.env.DISCORD_TOKEN);

// プロセス終了時の処理
process.on('SIGINT', () => {
  console.log('ボットをシャットダウンしています...');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('未処理のPromise拒否があります:', error);
}); 