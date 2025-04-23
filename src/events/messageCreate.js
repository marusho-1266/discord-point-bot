const { Events } = require('discord.js');
const pointService = require('../services/pointService');
const { checkUserActivity } = require('../services/activityService');

// イベント名を明示的に指定
module.exports = {
  name: 'messageCreate', // 文字列として指定（Events.MessageCreateの代わり）
  async execute(message) {
    // 起動時に確認ログを出力
    console.log(`[MessageCreate] イベントハンドラが呼び出されました`);
    console.log(`[MessageCreate] メッセージを受信: ${message.content.substring(0, 20)}... from ${message.author.tag}`);
    console.log(`[MessageCreate] チャンネル: ${message.channel.name}, ギルド: ${message.guild?.name || 'DM'}`);
    
    // Bot自身のメッセージは無視
    if (message.author.bot) {
      console.log('[MessageCreate] Botからのメッセージなので無視します');
      return;
    }
    
    // DMは無視
    if (!message.guild) {
      console.log('[MessageCreate] DMなので無視します');
      return;
    }
    
    try {
      console.log(`[MessageCreate] ユーザー活動を記録します: Guild=${message.guild.id}, User=${message.author.id}, Username=${message.author.username}`);
      
      // ユーザーの活動を記録し、ポイントを計算
      const pointResult = await checkUserActivity(
        message.guild.id,
        message.author.id,
        message.author.username
      );
      
      console.log('[MessageCreate] 活動記録結果:', JSON.stringify(pointResult));
      
      // ポイントが変動した場合はユーザーにDMで通知
      if (pointResult && pointResult.pointsChanged) {
        console.log(`[MessageCreate] ポイント変動通知を送信します: User=${message.author.username}, Points=${pointResult.points}`);
        try {
          let notificationMessage = `サーバー「${message.guild.name}」でのアクティビティにより、あなたのポイントが更新されました！\n`;
          notificationMessage += `現在のポイント: ${pointResult.points}\n`;
          notificationMessage += `連続活動日数: ${pointResult.consecutiveDays}日\n`;
          
          if (pointResult.isBonus) {
            notificationMessage += `🎉 連続ログインボーナスが付与されました！`;
          } else if (pointResult.isDecrease) {
            notificationMessage += `⚠️ 連続が途切れたため、連続日数がリセットされました。`;
          }
          
          await message.author.send(notificationMessage);
          console.log(`[MessageCreate] 通知を送信しました: User=${message.author.username}`);
        } catch (dmError) {
          console.error(`[MessageCreate] DMの送信に失敗しました: ${dmError.message}`);
          // DMが送れない場合は無視する（権限がない場合など）
        }
      }
    } catch (error) {
      console.error('[MessageCreate] メッセージ処理中にエラーが発生しました:', error);
    }
  },
};