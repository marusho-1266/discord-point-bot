const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserIdFromInteraction } = require('../utils/discordUtils');
const pointService = require('../services/pointService').pointService;
const { formatTimestamp } = require('../utils/dateUtils');
const userDataService = require('../services/userDataService');

// デイリーボーナスの設定
const DAILY_REWARD = {
  BASE: 10,                // 基本ポイント
  CONSECUTIVE_BONUS: 5,    // 連続ログインボーナス（日ごと）
  MAX_CONSECUTIVE_BONUS: 50 // 最大連続ボーナス（10日で上限）
};

async function handleRequest(interaction) {
  try {
    // Create a timeout to inform the user if the process is taking longer than expected
    const processingTimeout = setTimeout(() => {
      try {
        if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ content: 'デイリーリワードの処理中です。しばらくお待ちください...', ephemeral: true });
        }
      } catch (timeoutError) {
        console.error('Timeout notification error:', timeoutError);
      }
    }, 3000);

    const userId = getUserIdFromInteraction(interaction);
    const serverId = interaction.guildId;

    if (!serverId) {
      clearTimeout(processingTimeout);
      return interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', ephemeral: true });
    }

    const canClaim = await pointService.canClaimDaily(serverId, userId);

    if (!canClaim.success) {
      clearTimeout(processingTimeout);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ デイリー報酬を受け取れません')
        .setDescription(canClaim.message || 'エラーが発生しました。')
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const { consecutiveDays, streakBonus } = await pointService.getUserConsecutiveDays(serverId, userId);
    
    // 基本ポイント + ストリークボーナス（もしあれば）
    const basePoints = 1;
    const totalPoints = basePoints + streakBonus;
    
    // ポイント追加
    const addResult = await pointService.addPoints(serverId, userId, totalPoints, 'daily');
    
    clearTimeout(processingTimeout);

    if (addResult.success) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ デイリー報酬を受け取りました！')
        .setDescription(`${basePoints} ポイントを獲得しました！`)
        .addFields(
          { name: '現在の連続ログイン日数', value: `${consecutiveDays}日`, inline: true },
          { name: 'ストリークボーナス', value: `+${streakBonus}`, inline: true },
          { name: '合計獲得ポイント', value: `${totalPoints}`, inline: true },
          { name: '現在の所持ポイント', value: `${addResult.newTotal}`, inline: true },
          { name: '次回の報酬まで', value: '24時間', inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ エラーが発生しました')
        .setDescription('ポイントの追加中にエラーが発生しました。')
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Daily command error:', error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ 
          content: 'コマンドの実行中にエラーが発生しました。少し経ってからもう一度お試しください。', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error('Error replying to interaction:', replyError);
    }
  }
}

// For compatibility with the old API
async function execute(interaction) {
  return handleRequest(interaction);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('デイリーボーナスを受け取る'),
  handleRequest,
  execute
}; 