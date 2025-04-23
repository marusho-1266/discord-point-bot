// Discord スラッシュコマンドを登録するためのスクリプト
require('dotenv').config();
const { registerCommands } = require('./utils/setupCommands');

// コマンド登録を実行
registerCommands().then(() => {
  console.log('コマンド登録プロセスが完了しました。');
}); 