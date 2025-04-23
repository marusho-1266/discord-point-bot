const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addEventBonus } = require('../services/activityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-bonus')
    .setDescription('管理者用：イベント参加のボーナスポイントを付与する')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => 
      option.setName('user')
        .setDescription('ボーナスを付与するユーザー')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('points')
        .setDescription('ボーナスポイント')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option => 
      option.setName('event')
        .setDescription('イベント名')
        .setRequired(true)),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // 管理者権限の確認
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply({ content: 'このコマンドは管理者のみが使用できます。', ephemeral: true });
        return;
      }
      
      const targetUser = interaction.options.getUser('user');
      const bonusPoints = interaction.options.getInteger('points');
      const eventName = interaction.options.getString('event');
      
      // イベントボーナスを付与
      const updatedData = await addEventBonus(
        interaction.guild.id,
        targetUser.id,
        bonusPoints,
        eventName
      );
      
      // 結果メッセージの作成
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('イベントボーナス付与完了')
        .setDescription(`${targetUser.username} さんに ${bonusPoints} ポイントのイベントボーナスを付与しました`)
        .addFields(
          { name: 'イベント', value: eventName, inline: true },
          { name: '現在のポイント', value: `${updatedData.points} ポイント`, inline: true }
        )
        .setFooter({ text: `${interaction.user.username} による操作` })
        .setTimestamp();
      
      // 管理者に結果を返信
      await interaction.editReply({ embeds: [embed], ephemeral: true });
      
      // ユーザーにDMで通知
      try {
        const userEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('🎉 イベントボーナス獲得！')
          .setDescription(`${interaction.guild.name} サーバーのイベント参加で ${bonusPoints} ポイントを獲得しました！`)
          .addFields(
            { name: 'イベント', value: eventName, inline: true },
            { name: '現在のポイント', value: `${updatedData.points} ポイント`, inline: true }
          )
          .setFooter({ text: 'イベント参加ありがとうございました！' })
          .setTimestamp();
        
        await targetUser.send({ embeds: [userEmbed] });
      } catch (dmError) {
        console.error(`DMの送信に失敗しました (${targetUser.tag}):`, dmError);
        await interaction.followUp({ content: `ユーザー ${targetUser.username} へのDM送信に失敗しました。おそらくDMが無効になっています。`, ephemeral: true });
      }
    } catch (error) {
      console.error('イベントボーナス付与コマンド実行中にエラーが発生しました:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: 'ボーナス付与中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'ボーナス付与中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      }
    }
  },
}; 