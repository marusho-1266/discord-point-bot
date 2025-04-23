const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`${client.user.tag} としてログインしました！`);
    console.log(`${client.guilds.cache.size} サーバーに参加中`);
    
    // Botのステータス設定
    client.user.setPresence({
      activities: [{ name: 'ポイント管理', type: 4 }],
      status: 'online',
    });
    
    console.log('ボットは正常に起動しました。');
  },
}; 