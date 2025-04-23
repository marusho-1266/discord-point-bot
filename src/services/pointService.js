const sheetsService = require('./sheetsService');
const fetch = require('node-fetch');

// Google Sheets APIのURLを設定
const API_URL = process.env.GOOGLE_SHEETS_API_URL;

/**
 * ユーザーのポイントを取得
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @returns {Promise<number>} ユーザーのポイント
 */
async function getUserPoints(guildId, userId) {
  try {
    const userData = await sheetsService.getUserData(guildId, userId);
    return userData ? userData.points : 0;
  } catch (error) {
    console.error('ポイント取得中にエラーが発生しました:', error);
    return 0;
  }
}

/**
 * 管理者によるポイント手動追加
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} username ユーザー名
 * @param {number} points 追加するポイント
 * @param {string} reason ポイント追加理由
 * @returns {Promise<number>} 更新後の合計ポイント
 */
async function addPointsManually(guildId, userId, username, points, reason) {
  try {
    // 現在のユーザーデータを取得
    let userData = await sheetsService.getUserData(guildId, userId);
    
    if (!userData) {
      // 新規ユーザーの場合、初期データを作成
      userData = {
        guildId,
        userId,
        username,
        points: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        consecutiveDays: 0,
        joinDate: new Date().toISOString().split('T')[0]
      };
    }
    
    // ポイントを更新
    userData.points += points;
    
    // データを保存
    await sheetsService.saveUserData(userData);
    
    // ポイント履歴を記録
    await logPointsHistory(guildId, userId, points, reason);
    
    return userData.points;
  } catch (error) {
    console.error('ポイント追加中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * ポイント履歴を記録
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {number} points 追加されたポイント
 * @param {string} reason ポイント追加理由
 */
async function logPointsHistory(guildId, userId, points, reason) {
  try {
    const response = await fetch(`${API_URL}?action=logPointsHistory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}&points=${points}&reason=${encodeURIComponent(reason)}`,
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('ポイント履歴の記録中にエラーが発生しました:', result.error);
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('ポイント履歴の記録中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * ユーザーの連続投稿日数を取得
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @returns {Promise<number>} 連続投稿日数
 */
async function getUserConsecutiveDays(guildId, userId) {
  try {
    const userData = await sheetsService.getUserData(guildId, userId);
    return userData ? userData.consecutiveDays : 0;
  } catch (error) {
    console.error('連続投稿日数取得中にエラーが発生しました:', error);
    return 0;
  }
}

module.exports = {
  getUserPoints,
  addPointsManually,
  getUserConsecutiveDays
}; 