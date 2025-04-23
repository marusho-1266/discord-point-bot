const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * スラッシュコマンドを Discord に登録する
 */
async function registerCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  // コマンドファイルの読み込み
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[WARNING] ${filePath} のコマンドには必要な "data" または "execute" プロパティがありません。`);
    }
  }

  // Discord API へのリクエスト設定
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`${commands.length} 個のスラッシュコマンドを登録しています...`);

    // グローバルコマンドとして登録（全サーバーで使用可能）
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log(`${data.length} 個のスラッシュコマンドが正常に登録されました！`);
  } catch (error) {
    console.error('コマンド登録中にエラーが発生しました:', error);
  }
}

module.exports = {
  registerCommands,
}; 