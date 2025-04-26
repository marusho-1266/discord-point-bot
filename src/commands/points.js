const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheetsService = require('../services/sheetsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('自分のポイント情報を表示'),
  
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
      
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;
      
      // Google Sheetsからユーザーデータを取得
      const userData = await sheetsService.getUserData(guildId, userId);
      
      // 有効なインタラクションか確認
      if (!interaction.isRepliable()) {
        console.log('インタラクションが応答不可能な状態です');
        return;
      }
      
      if (!userData) {
        await interaction.editReply('ポイント情報がありません。会話に参加してポイントを獲得しましょう！').catch(error => {
          console.error('editReplyでエラーが発生しました:', error);
        });
        return;
      }
      
      // ポイント情報の埋め込みメッセージを作成
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌟 ポイント情報')
        .addFields(
          { name: 'ユーザー', value: `<@${userId}> (${userData.username})`, inline: true },
          { name: 'ポイント', value: `${userData.points}`, inline: true },
          { name: '連続投稿日数', value: `${userData.consecutiveDays}日`, inline: true },
          { name: '最終アクティブ日', value: userData.lastActiveDate || '情報なし', inline: true },
          { name: '参加日', value: userData.joinDate || '情報なし', inline: true }
        )
        .setFooter({ text: 'ポイントは毎日の会話で増えていきます！' })
        .setTimestamp();
      
      // インタラクションがまだ有効か確認
      if (!interaction.isRepliable()) {
        console.log('応答前にインタラクションが無効になりました');
        return;
      }
      
      await interaction.editReply({ embeds: [embed] }).catch(error => {
        console.error('embedの送信中にエラーが発生しました:', error);
      });
    } catch (error) {
      console.error('ポイントコマンド実行中にエラーが発生しました:', error);
      
      // インタラクションの状態を確認し、適切な方法でエラーを返す
      if (!interaction.isRepliable()) {
        console.log('エラー応答不可: インタラクションが無効です');
        return;
      }
      
      try {
        if (interaction.replied) {
          await interaction.followUp({ content: 'ポイント情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: 'ポイント情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        } else {
          await interaction.reply({ content: 'ポイント情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
        }
      } catch (responseError) {
        console.error('エラー応答の送信に失敗しました:', responseError);
      }
    }
  },
}; 