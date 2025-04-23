const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pointService = require('../services/pointService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-points')
    .setDescription('管理者用：ユーザーにポイントを手動で付与する')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => 
      option.setName('user')
        .setDescription('ポイントを付与するユーザー')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('points')
        .setDescription('付与するポイント（マイナス値も可）')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('ポイント付与の理由')
        .setRequired(false)),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // 管理者権限の確認
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply({ content: 'このコマンドは管理者のみが使用できます。', ephemeral: true });
        return;
      }
      
      const targetUser = interaction.options.getUser('user');
      const pointsToAdd = interaction.options.getInteger('points');
      const reason = interaction.options.getString('reason') || 'システム管理者によるポイント調整';
      
      // ポイントを手動で付与
      const updatedData = await pointService.addPointsManually(
        interaction.guild.id,
        targetUser.id,
        pointsToAdd,
        reason
      );
      
      // 結果メッセージの作成
      const actionType = pointsToAdd >= 0 ? '付与' : '減算';
      const embed = new EmbedBuilder()
        .setColor(pointsToAdd >= 0 ? 0x2ECC71 : 0xE74C3C)
        .setTitle(`ポイント${actionType}完了`)
        .setDescription(`${targetUser.username} さんに ${Math.abs(pointsToAdd)} ポイントを${actionType}しました`)
        .addFields(
          { name: '現在のポイント', value: `${updatedData.points} ポイント`, inline: true },
          { name: '理由', value: reason, inline: true }
        )
        .setFooter({ text: `${interaction.user.username} による操作` })
        .setTimestamp();
      
      // 管理者に結果を返信
      await interaction.editReply({ embeds: [embed], ephemeral: true });
      
      // ユーザーにDMで通知
      try {
        const userEmbed = new EmbedBuilder()
          .setColor(pointsToAdd >= 0 ? 0x2ECC71 : 0xE74C3C)
          .setTitle(`🔔 ポイント${actionType}のお知らせ`)
          .setDescription(`${interaction.guild.name} サーバーにて ${Math.abs(pointsToAdd)} ポイントが${actionType}されました`)
          .addFields(
            { name: '現在のポイント', value: `${updatedData.points} ポイント`, inline: true },
            { name: '理由', value: reason, inline: true }
          )
          .setFooter({ text: 'サーバー管理者による操作' })
          .setTimestamp();
        
        await targetUser.send({ embeds: [userEmbed] });
      } catch (dmError) {
        console.error(`DMの送信に失敗しました (${targetUser.tag}):`, dmError);
        await interaction.followUp({ content: `ユーザー ${targetUser.username} へのDM送信に失敗しました。おそらくDMが無効になっています。`, ephemeral: true });
      }
    } catch (error) {
      console.error('ポイント手動付与コマンド実行中にエラーが発生しました:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: 'ポイント付与中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'ポイント付与中にエラーが発生しました。しばらく経ってからもう一度お試しください。', ephemeral: true });
      }
    }
  },
}; 