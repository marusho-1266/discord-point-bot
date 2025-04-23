const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheetsService = require('../services/sheetsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('サーバー内のポイントランキングを表示')
    .addIntegerOption(option => 
      option.setName('limit')
        .setDescription('表示するランキングの数（デフォルト: 10）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)),
  
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const guildId = interaction.guild.id;
      const limit = interaction.options.getInteger('limit') || 10;
      
      // ランキングデータを取得
      const rankingData = await sheetsService.getServerRanking(guildId, limit);
      
      if (!rankingData || rankingData.length === 0) {
        await interaction.editReply('ランキングデータがありません。サーバーでの会話を増やしてポイントを獲得しましょう！');
        return;
      }
      
      // ランキングの埋め込みメッセージを作成
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🏆 ポイントランキング')
        .setDescription(`${interaction.guild.name} のポイントランキング（上位${limit}名）`)
        .setFooter({ text: 'ポイントは毎日の会話で増えていきます！' })
        .setTimestamp();
      
      // ランキングデータをフィールドとして追加
      const rankEmojis = ['🥇', '🥈', '🥉'];
      let description = '';
      
      rankingData.forEach((user, index) => {
        const rankDisplay = index < 3 ? rankEmojis[index] : `${user.rank}.`;
        description += `${rankDisplay} **${user.username}** - ${user.points} ポイント\n`;
      });
      
      embed.setDescription(description);
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('ランキングコマンド実行中にエラーが発生しました:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: 'ランキング情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'ランキング情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      }
    }
  },
}; 