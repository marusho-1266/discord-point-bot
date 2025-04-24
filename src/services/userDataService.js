const { sheetsService } = require('./sheetsService');

// ユーザーデータのメモリキャッシュ
// キー: `${guildId}_${userId}`, 値: { data: ユーザーデータ, timestamp: キャッシュ時刻 }
const userDataCache = new Map();

// キャッシュの有効期限（15分 = 15 * 60 * 1000ミリ秒）
const CACHE_TTL = 15 * 60 * 1000;

/**
 * ユーザーデータサービス
 * スプレッドシートとのやり取りを行い、必要に応じてキャッシュを活用します
 */
const userDataService = {
  /**
   * ユーザーデータを取得する
   * @param {string} guildId - ギルドID
   * @param {string} userId - ユーザーID
   * @returns {Promise<object|null>} ユーザーデータまたはnull
   */
  async getUserData(guildId, userId) {
    try {
      // キャッシュキーを生成
      const cacheKey = `${guildId}_${userId}`;
      
      // キャッシュをチェック
      const cachedData = userDataCache.get(cacheKey);
      
      // キャッシュが有効な場合はキャッシュから返す
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
        console.log(`キャッシュからユーザーデータを取得: ${userId}`);
        return cachedData.data;
      }
      
      // キャッシュがない場合はスプレッドシートから取得
      console.log(`キャッシュなし、スプレッドシートからユーザーデータを取得: ${userId}`);
      const userData = await sheetsService.getUserData(guildId, userId);
      
      // データが取得できた場合はキャッシュに保存
      if (userData) {
        userDataCache.set(cacheKey, {
          data: userData,
          timestamp: Date.now()
        });
      }
      
      return userData;
    } catch (error) {
      console.error(`ユーザーデータ取得エラー: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * ユーザーデータを保存する
   * @param {string} guildId - ギルドID
   * @param {string} userId - ユーザーID 
   * @param {object} userData - ユーザーデータ
   * @returns {Promise<boolean>} 保存成功の場合true
   */
  async saveUserData(guildId, userId, userData) {
    try {
      // スプレッドシートにデータを保存
      await sheetsService.saveUserData(guildId, userId, userData);
      
      // キャッシュを更新
      const cacheKey = `${guildId}_${userId}`;
      userDataCache.set(cacheKey, {
        data: userData,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error(`ユーザーデータ保存エラー: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * ポイント履歴を追加する
   * @param {string} guildId - ギルドID
   * @param {string} userId - ユーザーID
   * @param {number} points - ポイント数
   * @param {string} reason - 理由
   * @returns {Promise<boolean>} 保存成功の場合true
   */
  async addPointsHistory(guildId, userId, points, reason) {
    try {
      return await sheetsService.logPointsHistory(guildId, userId, points, reason);
    } catch (error) {
      console.error(`ポイント履歴追加エラー: ${error.message}`);
      // ポイント履歴の追加はクリティカルではないので、エラーを投げるだけにする
      throw error;
    }
  },
  
  /**
   * 特定ユーザーのキャッシュを無効化する
   * @param {string} guildId - ギルドID
   * @param {string} userId - ユーザーID
   */
  invalidateCache(guildId, userId) {
    const cacheKey = `${guildId}_${userId}`;
    userDataCache.delete(cacheKey);
    console.log(`キャッシュを無効化: ${userId}`);
  },
  
  /**
   * すべてのキャッシュをクリアする
   */
  clearAllCaches() {
    userDataCache.clear();
    console.log('すべてのキャッシュをクリア');
  }
};

module.exports = userDataService; 