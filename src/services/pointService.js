const { sheetsService } = require('./sheetsService');
const userDataService = require('./userDataService');

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
    const userData = await userDataService.getUserData(guildId, userId);
    return userData ? userData.points : 0;
  } catch (error) {
    console.error(`ポイント取得中にエラーが発生しました: ${error.message}`);
    return 0;
  }
}

/**
 * ユーザーの連続ログイン日数を取得
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @returns {Promise<number>} 連続ログイン日数
 */
async function getUserConsecutiveDays(guildId, userId) {
  try {
    const userData = await userDataService.getUserData(guildId, userId);
    return userData?.consecutiveDays || 0;
  } catch (error) {
    console.error(`連続ログイン日数取得エラー: ${error.message}`);
    return 0;
  }
}

/**
 * ポイントサービス
 * ユーザーのポイント関連の処理を行います
 */
const pointService = {
  /**
   * ポイントを追加する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {number} amount - 追加するポイント数
   * @param {string} reason - ポイント追加の理由
   * @returns {Promise<{newTotal: number, success: boolean}>}
   */
  async addPoints(guildId, userId, amount, reason) {
    try {
      // ユーザーデータを取得
      let userData = await userDataService.getUserData(guildId, userId);
      
      // ユーザーデータが存在しない場合は初期化
      if (!userData) {
        userData = {
          userId,
          points: 0,
          consecutiveDays: 0,
          lastDaily: null,
          lastVoiceActivity: null
        };
      }
      
      // ポイントを追加
      userData.points = (userData.points || 0) + amount;
      
      // ユーザーデータを保存
      await userDataService.saveUserData(guildId, userId, userData);
      
      // ポイント履歴を記録
      try {
        await userDataService.addPointsHistory(guildId, userId, amount, reason);
      } catch (historyError) {
        console.error(`ポイント履歴の記録に失敗しました: ${historyError.message}`);
        // 履歴記録失敗は全体の処理を中断しない
      }
      
      return {
        newTotal: userData.points,
        success: true
      };
    } catch (error) {
      console.error(`ポイント追加エラー: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 手動でポイントを追加
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {number} points - ポイント数
   * @param {string} reason - ポイント付与の理由（省略可）
   * @returns {Promise<{success: boolean, error: string|null, newTotal: number}>} 結果
   */
  async addPointsManually(guildId, userId, pointsToAdd, reason = '') {
    try {
      console.log(`手動ポイント変更: ギルド ${guildId}, ユーザー ${userId}, 追加: ${pointsToAdd}, 理由: ${reason}`);
      
      // 現在のポイントを取得
      const { success: fetchSuccess, points: currentPoints } = await sheetsService.getPoints(guildId, userId);
      if (!fetchSuccess) {
        throw new Error('現在のポイント取得に失敗しました');
      }
      
      // 新しいポイント合計を計算
      const previousTotal = currentPoints || 0;
      const newPoints = previousTotal + pointsToAdd;
      
      // ポイントを更新
      const updateResult = await sheetsService.updatePoints(guildId, userId, newPoints);
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'ポイント更新に失敗しました');
      }
      
      // ポイント履歴を記録
      try {
        // システム管理者による調整の場合は理由を修正
        const historyReason = reason || 'システム管理者によるポイント調整';
        await sheetsService.logPointsHistory(guildId, userId, pointsToAdd, newPoints, historyReason);
      } catch (historyError) {
        // 履歴記録に失敗してもポイント自体は更新されているので警告だけ出す
        console.warn(`ポイント履歴の記録に失敗しましたが、ポイントは正常に更新されました: ${historyError.message}`);
      }
      
      console.log(`ポイント手動変更成功: ${userId}, 前回: ${previousTotal}, 変更: ${pointsToAdd}, 新合計: ${newPoints}`);
      return { 
        success: true, 
        previousTotal,
        pointsChange: pointsToAdd,
        newTotal: newPoints 
      };
    } catch (error) {
      console.error(`ポイント手動変更エラー: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * ユーザーの現在のポイントを取得する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @returns {Promise<{points: number, success: boolean, error?: string}>}
   */
  async getPoints(guildId, userId) {
    try {
      const userData = await userDataService.getUserData(guildId, userId);
      
      if (!userData) {
        return {
          points: 0,
          success: true
        };
      }
      
      return {
        points: userData.points || 0,
        success: true
      };
    } catch (error) {
      console.error(`ポイント取得エラー: ${error.message}`);
      return {
        points: 0,
        success: false,
        error: `ポイント取得中にエラーが発生しました: ${error.message}`
      };
    }
  },
  
  /**
   * ユーザーの連続ログイン日数を取得する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @returns {Promise<number>} - 連続ログイン日数
   */
  async getUserConsecutiveDays(guildId, userId) {
    try {
      const userData = await userDataService.getUserData(guildId, userId);
      return userData?.consecutiveDays || 0;
    } catch (error) {
      console.error('連続ログイン日数取得エラー:', error);
      throw new Error(`連続ログイン日数取得中にエラーが発生しました: ${error.message}`);
    }
  }
};

module.exports = {
  getUserPoints,
  pointService,
  // getUserConsecutiveDaysは既にpointService.getUserConsecutiveDaysとして提供されているため、
  // トップレベル関数からの参照を削除して、代わりにpointService経由で使用するように変更
} 