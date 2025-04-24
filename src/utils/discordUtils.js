/**
 * Discordに関する共通ユーティリティ関数を提供します
 */

/**
 * インタラクションからサーバーIDを取得します
 * @param {import('discord.js').CommandInteraction} interaction - Discordインタラクション
 * @returns {string|null} サーバーID、見つからない場合はnull
 */
function getGuildIdFromInteraction(interaction) {
  // 直接guildIdを取得
  if (interaction.guildId) {
    return interaction.guildId;
  }
  
  // guildIdが存在しない場合、guildオブジェクトからIDを取得
  if (interaction.guild && interaction.guild.id) {
    return interaction.guild.id;
  }
  
  // チャンネル経由でguildを取得
  if (interaction.channel && interaction.channel.guild) {
    return interaction.channel.guild.id;
  }
  
  // messageオブジェクト経由でguildを取得
  if (interaction.message && interaction.message.guild) {
    return interaction.message.guild.id;
  }
  
  console.warn('インタラクションからサーバーIDを取得できませんでした');
  return null;
}

/**
 * インタラクションからユーザーIDを取得します
 * @param {import('discord.js').CommandInteraction} interaction - Discordインタラクション
 * @returns {string|null} ユーザーID、見つからない場合はnull
 */
function getUserIdFromInteraction(interaction) {
  // userオブジェクトからIDを取得
  if (interaction.user && interaction.user.id) {
    return interaction.user.id;
  }
  
  // memberオブジェクトからIDを取得
  if (interaction.member && interaction.member.id) {
    return interaction.member.id;
  }
  
  console.warn('インタラクションからユーザーIDを取得できませんでした');
  return null;
}

/**
 * インタラクションからチャンネルIDを取得します
 * @param {import('discord.js').CommandInteraction} interaction - Discordインタラクション
 * @returns {string|null} チャンネルID、見つからない場合はnull
 */
function getChannelIdFromInteraction(interaction) {
  // 直接channelIdを取得
  if (interaction.channelId) {
    return interaction.channelId;
  }
  
  // channelオブジェクトからIDを取得
  if (interaction.channel && interaction.channel.id) {
    return interaction.channel.id;
  }
  
  console.warn('インタラクションからチャンネルIDを取得できませんでした');
  return null;
}

module.exports = {
  getGuildIdFromInteraction,
  getUserIdFromInteraction,
  getChannelIdFromInteraction
}; 