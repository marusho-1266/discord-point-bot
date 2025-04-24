const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('ポイントシステムの使い方を表示します'),
  
  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('💡 ポイントシステムの使い方')
        .setDescription('このボットは、サーバーでの活動に応じてポイントを付与するシステムです。')
        .addFields(
          { 
            name: '📝 ポイントの獲得方法', 
            value: '```• 毎日メッセージを投稿する：1ポイント\n• 連続で投稿する：連続日数に応じたボーナス\n• イベント参加：管理者が設定したボーナス```' 
          },
          { 
            name: '📊 ポイントの確認', 
            value: '```/points - 自分のポイント情報\n/ranking - サーバー内ランキング```' 
          },
          { 
            name: '⚠️ 注意事項', 
            value: '```• 連続投稿が途切れるとポイントがリセットされます\n• ポイントに関する通知はDMで送信されます\n• ボーナスは10日ごとに付与されます```' 
          },
          { 
            name: '🔍 管理者向けコマンド', 
            value: '```/admin-points - ポイントの手動付与/減算\n/event-bonus - イベント参加ボーナスの付与```' 
          }
        )
        .setFooter({ text: 'その他質問があれば、サーバー管理者にお問い合わせください。' });
      
      // 応答状態をチェック
      if (interaction.replied) {
        console.log('helpコマンド: インタラクションはすでに応答済みのため、followUpを使用');
        await interaction.followUp({ embeds: [embed] }).catch(err => {
          console.error('helpコマンド: followUpに失敗', err);
        });
      } else if (interaction.deferred) {
        console.log('helpコマンド: インタラクションは遅延中のため、editReplyを使用');
        await interaction.editReply({ embeds: [embed] }).catch(err => {
          console.error('helpコマンド: editReplyに失敗', err);
        });
      } else {
        console.log('helpコマンド: 新規応答を送信');
        await interaction.reply({ embeds: [embed] }).catch(err => {
          console.error('helpコマンド: replyに失敗', err);
        });
      }
    } catch (error) {
      console.error('ヘルプコマンド実行中にエラーが発生しました:', error);
      
      try {
        // エラー応答
        const errorMsg = { 
          content: 'コマンド実行中にエラーが発生しました。', 
          ephemeral: true 
        };
        
        // 応答状態をチェック
        if (interaction.replied) {
          await interaction.followUp(errorMsg).catch(e => 
            console.error('helpコマンド: エラー応答のfollowUpに失敗', e));
        } else if (interaction.deferred) {
          await interaction.editReply(errorMsg).catch(e => 
            console.error('helpコマンド: エラー応答のeditReplyに失敗', e));
        } else {
          await interaction.reply(errorMsg).catch(e => 
            console.error('helpコマンド: エラー応答のreplyに失敗', e));
        }
      } catch (responseError) {
        console.error('helpコマンド: エラー応答処理自体が失敗:', responseError);
      }
    }
  },
}; 