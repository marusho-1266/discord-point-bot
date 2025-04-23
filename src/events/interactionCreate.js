const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // スラッシュコマンドのみを処理
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`${interaction.commandName} というコマンドは見つかりませんでした。`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`${interaction.commandName} コマンドの実行中にエラーが発生しました:`, error);
      
      // エラー応答
      const errorResponse = { 
        content: 'このコマンドの実行中にエラーが発生しました。', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    }
  },
}; 