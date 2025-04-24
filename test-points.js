// テスト用スクリプト
const pointService = require('./src/services/pointService');

const testData = {
  guildId: 'test-guild-id',
  userId: 'test-user-id',
  username: 'test-user',
  points: 5,
  reason: 'テスト実行'
};

console.log('ポイント手動追加のテストを開始します...');

async function runTest() {
  try {
    console.log('====== テスト実行開始 ======');
    
    const result = await pointService.addPointsManually(
      testData.guildId,
      testData.userId,
      testData.username,
      testData.points,
      testData.reason
    );
    
    console.log('====== テスト実行結果 ======');
    console.log('結果:', result);
    console.log('====== テスト完了 ======');
    
    // プロセスを終了
    setTimeout(() => {
      console.log('プロセスを終了します');
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

runTest().catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
}); 