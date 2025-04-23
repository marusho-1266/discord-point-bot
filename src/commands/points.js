const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pointService = require('../services/pointService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('自分のポイント情報を確認する'),
  
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      
      // ポイント情報を取得
      const points = await pointService.getUserPoints(guildId, userId);
      const consecutiveDays = await pointService.getUserConsecutiveDays(guildId, userId);
      
      // 次の連続ボーナスまでの日数を計算
      const bonusDays = parseInt(process.env.CONSECUTIVE_BONUS_DAYS) || 10;
      const daysUntilNextBonus = bonusDays - (consecutiveDays % bonusDays);
      const nextBonusDay = consecutiveDays + daysUntilNextBonus;
      
      // 埋め込みメッセージを作成
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🏆 ポイント情報')
        .setDescription(`${interaction.user.username} さんのポイント情報です`)
        .addFields(
          { name: '現在のポイント', value: `${points} ポイント`, inline: true },
          { name: '連続投稿日数', value: `${consecutiveDays} 日`, inline: true },
          { name: '次のボーナス', value: `あと ${daysUntilNextBonus} 日（${nextBonusDay}日達成時）`, inline: false }
        )
        .setFooter({ text: `${interaction.guild.name} | ポイントシステム` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('ポイント確認コマンド実行中にエラーが発生しました:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: 'ポイント情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'ポイント情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      }
    }
  },
}; 