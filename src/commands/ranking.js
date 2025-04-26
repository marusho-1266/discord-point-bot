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
    // deferReplyの前にチェック
    if (interaction.replied || interaction.deferred) {
      console.log('インタラクションはすでに応答済みまたは遅延中です');
      return;
    }

    try {
      await interaction.deferReply().catch(error => {
        console.error('deferReplyでエラーが発生しました:', error);
        // タイムアウトなどですでにインタラクションが無効になっている可能性
        return;
      });
      
      const guildId = interaction.guild.id;
      const limit = interaction.options.getInteger('limit') || 10;
      
      // ランキングデータを取得
      const rankingData = await sheetsService.getServerRanking(guildId, limit);
      
      // 有効なインタラクションか確認
      if (!interaction.isRepliable()) {
        console.log('インタラクションが応答不可能な状態です');
        return;
      }

      if (!rankingData || rankingData.length === 0) {
        await interaction.editReply('ランキングデータがありません。サーバーでの会話を増やしてポイントを獲得しましょう！').catch(error => {
          console.error('editReplyでエラーが発生しました:', error);
        });
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
      
      // インタラクションがまだ有効か確認
      if (!interaction.isRepliable()) {
        console.log('応答前にインタラクションが無効になりました');
        return;
      }
      
      await interaction.editReply({ embeds: [embed] }).catch(error => {
        console.error('embedの送信中にエラーが発生しました:', error);
      });
    } catch (error) {
      console.error('ランキングコマンド実行中にエラーが発生しました:', error);
      
      // インタラクションの状態を確認し、適切な方法でエラーを返す
      if (!interaction.isRepliable()) {
        console.log('エラー応答不可: インタラクションが無効です');
        return;
      }
      
      try {
        if (interaction.replied) {
          await interaction.followUp({ content: 'ランキング情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: 'ランキング情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        } else {
          await interaction.reply({ content: 'ランキング情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        }
      } catch (responseError) {
        console.error('エラー応答の送信に失敗しました:', responseError);
      }
    }
  },
}; 