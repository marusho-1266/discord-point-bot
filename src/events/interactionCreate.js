const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // スラッシュコマンドのみを処理
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`${interaction.commandName} というコマンドは見つかりませんでした。`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`${interaction.commandName} コマンドの実行中にエラーが発生しました:`, error);
      
      // エラー発生時の対応を試みる
      try {
        // エラー応答
        const errorResponse = { 
          content: 'このコマンドの実行中にエラーが発生しました。', 
          ephemeral: true 
        };
        
        // すでに応答済みか確認
        if (interaction.replied) {
          // すでに応答済みの場合はフォローアップメッセージを送信
          console.log('インタラクションはすでに応答済みのため、followUpを使用します');
          await interaction.followUp(errorResponse).catch(followUpError => {
            // フォローアップにも失敗した場合は単にログ出力
            console.error('エラーメッセージのフォローアップに失敗しました:', followUpError);
          });
        } else if (interaction.deferred) {
          // 応答が遅延されている場合は編集
          console.log('インタラクションは遅延中のため、editReplyを使用します');
          await interaction.editReply(errorResponse).catch(editError => {
            console.error('遅延応答の編集に失敗しました:', editError);
          });
        } else {
          // まだ応答していない場合は新規応答
          console.log('新規応答を送信します');
          await interaction.reply(errorResponse).catch(replyError => {
            console.error('エラー応答の送信に失敗しました:', replyError);
            // すでに応答済みかタイムアウトの可能性があるためログのみ
          });
        }
      } catch (responseError) {
        // エラー応答自体が失敗した場合
        console.error('エラー応答の処理中に例外が発生しました:', responseError);
        // このエラーは上位で捕捉されないよう、ここで処理を終了
      }
    }
  },
}; 