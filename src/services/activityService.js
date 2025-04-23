const sheetsService = require('./sheetsService');
const pointService = require('./pointService');
const fetch = require('node-fetch');

// Google Sheets APIのURLを設定
const API_URL = process.env.GOOGLE_SHEETS_API_URL;

/**
 * ユーザーの活動を確認し、必要に応じてポイントを計算する
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} username ユーザー名
 * @returns {Promise<Object>} ポイント計算結果
 */
async function checkUserActivity(guildId, userId, username) {
  try {
    console.log(`checkUserActivity開始: Guild=${guildId}, User=${userId}, Username=${username}`);
    
    // ユーザーデータの取得または初期化
    let userData = await sheetsService.getUserData(guildId, userId);
    console.log('取得したユーザーデータ:', userData);
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    let pointsChanged = false;
    let isBonus = false;
    let isDecrease = false;
    let initialPoints = 0;
    
    if (!userData) {
      console.log('新規ユーザーなので初期データを作成します');
      // 新規ユーザーの場合は初期データを作成
      userData = {
        guildId,
        userId,
        username,
        points: 1, // 新規ユーザーは1ポイント付与
        lastActiveDate: currentDate,
        consecutiveDays: 1,
        joinDate: currentDate
      };
      pointsChanged = true;
      
      // データを保存
      console.log('新規ユーザーデータを保存します:', userData);
      await sheetsService.saveUserData(userData);
      
      // メッセージ活動履歴とポイント履歴を記録
      console.log('ポイント履歴を記録します');
      await logPointsHistory(guildId, userId, 1, '初回メッセージ投稿');
      
      return {
        pointsChanged: true,
        points: userData.points,
        consecutiveDays: userData.consecutiveDays,
        isBonus: false,
        isDecrease: false
      };
    }
    
    // 既存ユーザーの場合の処理
    initialPoints = userData.points;
    const lastActiveDate = userData.lastActiveDate || currentDate;
    const dayDifference = getDayDifference(lastActiveDate, currentDate);
    
    // 今日既にアクティブな場合は何もしない
    if (dayDifference === 0) {
      return {
        pointsChanged: false,
        points: userData.points,
        consecutiveDays: userData.consecutiveDays,
        isBonus: false,
        isDecrease: false
      };
    }
    
    // 連続日数の更新
    if (dayDifference === 1) {
      // 連続で投稿している場合
      userData.consecutiveDays = (userData.consecutiveDays || 0) + 1;
      userData.lastActiveDate = currentDate;
      
      // 通常のメッセージポイント
      userData.points = (userData.points || 0) + 1;
      pointsChanged = true;
      
      // 連続ボーナスの確認
      const bonusPoints = calculateConsecutiveBonus(userData.consecutiveDays);
      if (bonusPoints > 0) {
        userData.points += bonusPoints;
        isBonus = true;
        // ボーナスポイント履歴を記録
        await logPointsHistory(guildId, userId, bonusPoints, `連続ログインボーナス: ${userData.consecutiveDays}日目`);
      }
    } else if (dayDifference > 1) {
      // 連続が途切れた場合
      userData.consecutiveDays = 1;
      userData.lastActiveDate = currentDate;
      userData.points = (userData.points || 0) + 1;
      pointsChanged = true;
      isDecrease = true;
    }
    
    // 更新されたデータを保存
    await sheetsService.saveUserData(userData);
    
    // メッセージ活動履歴を記録
    await logPointsHistory(guildId, userId, 1, 'メッセージ投稿');

    // 最後に結果をログ出力
    console.log('checkUserActivity完了:', {
      pointsChanged,
      points: userData.points,
      consecutiveDays: userData.consecutiveDays,
      isBonus,
      isDecrease
    });
    
    return {
      pointsChanged,
      points: userData.points,
      consecutiveDays: userData.consecutiveDays,
      isBonus,
      isDecrease
    };
  } catch (error) {
    console.error('ユーザー活動の確認中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * ユーザーのメッセージ活動を記録する
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} username ユーザー名
 * @param {string} channelId チャンネルID
 * @returns {Promise<object>} 更新されたユーザーデータ
 */
async function logMessageActivity(guildId, userId, username, channelId) {
  try {
    // ユーザーデータの取得または初期化
    let userData = await sheetsService.getUserData(guildId, userId);
    const currentDate = new Date().toISOString().split('T')[0];
    
    if (!userData) {
      // 新規ユーザーの場合は初期データを作成
      userData = {
        guildId,
        userId,
        username,
        points: 0,
        lastActiveDate: currentDate,
        consecutiveDays: 1,
        joinDate: currentDate
      };
    } else {
      // 既存ユーザーの場合はデータを更新
      const lastActiveDate = userData.lastActiveDate || currentDate;
      const dayDifference = getDayDifference(lastActiveDate, currentDate);
      
      if (dayDifference === 0) {
        // 同日の活動の場合は何もしない
      } else if (dayDifference === 1) {
        // 連続日の場合は連続日数を増加
        userData.consecutiveDays = (userData.consecutiveDays || 0) + 1;
        userData.lastActiveDate = currentDate;
        
        // 連続ログインボーナスの処理
        const bonusPoints = calculateConsecutiveBonus(userData.consecutiveDays);
        if (bonusPoints > 0) {
          userData.points = (userData.points || 0) + bonusPoints;
          // ボーナスポイント履歴を記録
          logPointsHistory(guildId, userId, bonusPoints, `連続ログインボーナス: ${userData.consecutiveDays}日目`);
        }
      } else {
        // 連続が途切れた場合は連続日数をリセット
        userData.consecutiveDays = 1;
        userData.lastActiveDate = currentDate;
      }
    }
    
    // 通常のメッセージポイントを加算
    const messagePoints = 1;
    userData.points = (userData.points || 0) + messagePoints;
    
    // 更新されたデータを保存
    await sheetsService.saveUserData(userData);
    
    // メッセージ活動履歴を記録
    await logActivityHistory(guildId, userId, 'message', channelId);
    
    // ポイント履歴を記録
    await logPointsHistory(guildId, userId, messagePoints, 'メッセージ投稿');
    
    return userData;
  } catch (error) {
    console.error('メッセージ活動のログ記録中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * ユーザーのイベント参加を記録する
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} username ユーザー名
 * @param {string} eventName イベント名
 * @param {number} bonusPoints ボーナスポイント
 * @returns {Promise<object>} 更新されたユーザーデータ
 */
async function logEventParticipation(guildId, userId, username, eventName, bonusPoints = 5) {
  try {
    // ユーザーデータの取得または初期化
    let userData = await sheetsService.getUserData(guildId, userId);
    const currentDate = new Date().toISOString().split('T')[0];
    
    if (!userData) {
      // 新規ユーザーの場合は初期データを作成
      userData = {
        guildId,
        userId,
        username,
        points: bonusPoints,
        lastActiveDate: currentDate,
        consecutiveDays: 1,
        joinDate: currentDate
      };
    } else {
      // 既存ユーザーの場合はポイントを加算
      userData.points = (userData.points || 0) + bonusPoints;
      
      // 最終活動日の更新（連続日数は更新しない）
      if (!userData.lastActiveDate || getDayDifference(userData.lastActiveDate, currentDate) > 0) {
        userData.lastActiveDate = currentDate;
      }
    }
    
    // 更新されたデータを保存
    await sheetsService.saveUserData(userData);
    
    // イベント参加をGoogle Apps Scriptに記録
    await sheetsService.logEventParticipation(guildId, userId, eventName, bonusPoints);
    
    // ポイント履歴を記録
    await logPointsHistory(guildId, userId, bonusPoints, `イベント参加: ${eventName}`);
    
    return userData;
  } catch (error) {
    console.error('イベント参加のログ記録中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * 活動履歴を記録
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} activityType アクティビティタイプ（message, voice, etc）
 * @param {string} channelId チャンネルID
 */
async function logActivityHistory(guildId, userId, activityType, channelId) {
  try {
    const response = await fetch(`${API_URL}?action=logActivityHistory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}&activityType=${encodeURIComponent(activityType)}&channelId=${encodeURIComponent(channelId)}`,
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('活動履歴の記録中にエラーが発生しました:', result.error);
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('活動履歴の記録中にエラーが発生しました:', error);
    // 履歴記録のエラーはスローせず、ログのみ
  }
}

/**
 * ポイント履歴を記録
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {number} points 付与されたポイント
 * @param {string} reason 理由
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
    // 履歴記録のエラーはスローせず、ログのみ
  }
}

/**
 * 連続ログインボーナスを計算
 * @param {number} consecutiveDays 連続日数
 * @returns {number} ボーナスポイント
 */
function calculateConsecutiveBonus(consecutiveDays) {
  // 連続ログインボーナスのルール
  if (consecutiveDays % 30 === 0) return 50;  // 30日ごとに50ポイント
  if (consecutiveDays % 7 === 0) return 15;   // 7日ごとに15ポイント
  if (consecutiveDays % 3 === 0) return 5;    // 3日ごとに5ポイント
  return 0;  // それ以外は0ポイント
}

/**
 * 2つの日付の日数差を計算
 * @param {string} date1 YYYY-MM-DD形式の日付
 * @param {string} date2 YYYY-MM-DD形式の日付
 * @returns {number} 日数差
 */
function getDayDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const timeDiff = d2.getTime() - d1.getTime();
  return Math.floor(timeDiff / (1000 * 3600 * 24));
}

module.exports = {
  checkUserActivity,
  logMessageActivity,
  logEventParticipation
}; 