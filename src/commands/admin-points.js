const { EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { pointService } = require('../services/pointService');
const { getGuildIdFromInteraction, getUserIdFromInteraction } = require('../utils/discordUtils');
const { ApplicationCommandOptionType } = require('discord.js');

/**
 * リクエストを処理する
 * @param {import('discord.js').CommandInteraction} interaction
 */
async function handleRequest(interaction) {
  let notificationTimeout = null;
  let followupNotificationTimeout = null;
  
  try {
    // Defer the reply to avoid timeout
    await interaction.deferReply({ ephemeral: true });
    
    const user = interaction.options.getUser('user');
    const userId = user?.id;
    const amount = interaction.options.getInteger('amount') || interaction.options.getInteger('points');
    const reason = interaction.options.getString('reason') || "システム管理者によるポイント調整";
    const guildId = interaction.guildId;
    
    if (!guildId) {
      return await interaction.editReply("このコマンドはサーバー内でのみ使用できます。");
    }
    
    if (!userId) {
      return await interaction.editReply("ユーザーを指定してください。");
    }
    
    if (!amount || amount <= 0) {
      return await interaction.editReply("1以上のポイントを指定してください。");
    }
    
    console.log(`管理者がポイント付与を開始: ${userId}さんに${amount}ポイント`);
    
    // Setup timeout for user notification if process takes too long
    notificationTimeout = setTimeout(async () => {
      try {
        console.log('初回通知タイムアウト発火');
        await interaction.editReply(`${user}さんに ${amount} ポイントを付与しています。少々お待ちください...`);
        
        // Add a follow-up message if it takes even longer
        followupNotificationTimeout = setTimeout(async () => {
          try {
            console.log('フォローアップ通知タイムアウト発火');
            await interaction.editReply(`${user}さんへのポイント付与処理をまだ実行中です。しばらくお待ちください...`);
          } catch (notifyError) {
            console.error(`Error sending follow-up notification: ${notifyError}`);
          }
        }, 5000); // Send follow-up after an additional 5 seconds
        
      } catch (notifyError) {
        console.error(`Error sending notification: ${notifyError}`);
      }
    }, 3000); // Notify after 3 seconds
    
    console.log('pointService.addPointsManually呼び出し開始');
    const result = await pointService.addPointsManually(guildId, userId, amount, reason);
    console.log('pointService.addPointsManually呼び出し完了:', result);
    
    // Clear the timeouts
    if (notificationTimeout) {
      console.log('初回通知タイムアウトをクリア');
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
    
    if (followupNotificationTimeout) {
      console.log('フォローアップ通知タイムアウトをクリア');
      clearTimeout(followupNotificationTimeout);
      followupNotificationTimeout = null;
    }
    
    if (result.success) {
      console.log('ポイント付与成功、応答作成');
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('ポイント調整完了')
        .setDescription(`${user}さんに ${amount} ポイントを付与しました。`)
        .addFields(
          { name: '付与前ポイント', value: `${result.previousTotal || 0}`, inline: true },
          { name: '付与後ポイント', value: `${result.newTotal || 0}`, inline: true },
          { name: '理由', value: reason || 'システム管理者によるポイント調整' }
        )
        .setTimestamp();
      
      console.log('成功応答を送信');
      return await interaction.editReply({ embeds: [embed] });
    } else {
      console.log('ポイント付与失敗、エラー応答作成');
      return await interaction.editReply(`ポイントの付与に失敗しました: ${result.error || '不明なエラー'}`);
    }
  } catch (error) {
    console.error(`Error in admin-points command: ${error}`);
    
    // Clear the timeouts if still active
    if (notificationTimeout) {
      console.log('エラー時に初回通知タイムアウトをクリア');
      clearTimeout(notificationTimeout);
    }
    
    if (followupNotificationTimeout) {
      console.log('エラー時にフォローアップ通知タイムアウトをクリア');
      clearTimeout(followupNotificationTimeout);
    }
    
    try {
      if (interaction.deferred) {
        await interaction.editReply(`エラーが発生しました: ${error.message || error}`);
      } else if (!interaction.replied) {
        await interaction.reply({ content: `エラーが発生しました: ${error.message || error}`, ephemeral: true });
      }
    } catch (replyError) {
      console.error(`Failed to send error message: ${replyError}`);
    }
  }
}

// 以前のAPIとの互換性のためにexecute関数を追加
async function execute(interaction) {
  return await handleRequest(interaction);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-points')
    .setDescription('管理者用：ユーザーにポイントを付与・削減')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('ポイントを変更するユーザー')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('amount')
        .setDescription('変更するポイント数（正の整数）')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('ポイント変更の理由')
        .setRequired(false)),
  handleRequest,
  execute
}; 