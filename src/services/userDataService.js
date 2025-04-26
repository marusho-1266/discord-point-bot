const { sheetsService } = require('./sheetsService');

// ユーザーデータのメモリキャッシュ
// キー: `${guildId}_${userId}`, 値: { data: ユーザーデータ, timestamp: キャッシュ時刻 }
const userDataCache = new Map();

// ランキングデータのキャッシュ
// キー: `ranking_${guildId}`, 値: { data: ランキングデータ, timestamp: キャッシュ時刻 }
const rankingCache = new Map();

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
   * サーバーのユーザーランキングを取得する
   * @param {string} guildId - ギルドID
   * @param {number} limit - 取得する上位ユーザー数（デフォルト10）
   * @returns {Promise<Array>} ランキング配列（オブジェクトの配列）
   */
  async getServerRanking(guildId, limit = 10) {
    try {
      // キャッシュキーを生成
      const cacheKey = `ranking_${guildId}`;
      
      // キャッシュをチェック
      const cachedData = rankingCache.get(cacheKey);
      
      // キャッシュが有効な場合はキャッシュから返す
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
        console.log(`キャッシュからランキングデータを取得: ${guildId}`);
        return cachedData.data.slice(0, limit); // limitに基づいて結果を制限
      }
      
      console.log(`ランキングデータをスプレッドシートから取得: ${guildId}`);
      
      // 全ユーザーデータを取得してメモリで処理
      // APIから直接ランキングを取得できない場合の代替手段
      const allUsers = await this.getAllUsersInGuild(guildId);
      
      if (!allUsers || allUsers.length === 0) {
        console.log(`サーバー ${guildId} にユーザーデータが見つかりません`);
        return [];
      }
      
      // ポイントでソート
      const sortedUsers = allUsers.sort((a, b) => {
        return (b.points || 0) - (a.points || 0);
      });
      
      // ランク付け
      const rankedUsers = sortedUsers.map((user, index) => {
        return {
          rank: index + 1,
          userId: user.userId,
          username: user.username,
          points: user.points || 0
        };
      });
      
      // キャッシュに保存（全ランキングデータを保存）
      rankingCache.set(cacheKey, {
        data: rankedUsers,
        timestamp: Date.now()
      });
      
      // 要求された数だけ返す
      return rankedUsers.slice(0, limit);
    } catch (error) {
      console.error(`ランキングデータ取得エラー: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * サーバー内の全ユーザーデータを取得
   * @param {string} guildId - ギルドID
   * @returns {Promise<Array>} ユーザーデータの配列
   * @private
   */
  async getAllUsersInGuild(guildId) {
    try {
      // 一時的な実装として、Google Sheets APIを使用してサーバー内のすべてのユーザーを取得
      // この実装はGoogle Apps Scriptのスクリプト側で適切なエンドポイントが必要です
      
      // シート全体を取得し、サーバーIDでフィルタリング
      // これは効率的ではないため、将来的にはサーバーIDごとのデータを取得する専用エンドポイントを実装することをお勧めします
      const response = await sheetsService.callGoogleAppsScript('getAllUsers', []);
      
      if (!response || !Array.isArray(response)) {
        console.error('getAllUsersの応答が無効です:', response);
        return [];
      }
      
      // サーバーIDでフィルタリング
      return response.filter(user => user.guildId === guildId);
    } catch (error) {
      console.error(`サーバー内ユーザー取得エラー: ${error.message}`);
      return [];
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
      
      // ユーザーデータが変更されたのでランキングキャッシュも無効化
      this.invalidateRankingCache(guildId);
      
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
    
    // ユーザーデータが変わったのでランキングキャッシュも無効化
    this.invalidateRankingCache(guildId);
  },
  
  /**
   * サーバーのランキングキャッシュを無効化する
   * @param {string} guildId - ギルドID
   */
  invalidateRankingCache(guildId) {
    const cacheKey = `ranking_${guildId}`;
    rankingCache.delete(cacheKey);
    console.log(`ランキングキャッシュを無効化: ${guildId}`);
  },
  
  /**
   * すべてのキャッシュをクリアする
   */
  clearAllCaches() {
    userDataCache.clear();
    rankingCache.clear();
    console.log('すべてのキャッシュをクリア');
  }
};

module.exports = userDataService; 