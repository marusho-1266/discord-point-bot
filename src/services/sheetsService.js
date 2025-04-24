const path = require('path');
const fs = require('fs');
const axios = require('axios');

// 環境変数設定
const GOOGLE_API_URL = process.env.GOOGLE_API_URL;
const SCRIPT_ID = process.env.GOOGLE_SCRIPT_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

// ローカルデータキャッシュのパス設定
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_DATA_FILE = path.join(DATA_DIR, 'users.json');

// ユーザーデータのキャッシュ
let userDataCache = {};
let lastCacheUpdate = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分キャッシュ

// ローカルデータの保存
async function saveLocalData() {
  try {
    // データディレクトリが存在しない場合は作成
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // キャッシュデータをファイルに保存
    fs.writeFileSync(
      USERS_DATA_FILE,
      JSON.stringify(userDataCache, null, 2)
    );
    console.log('ローカルデータが保存されました');
  } catch (error) {
    console.error('ローカルデータの保存中にエラーが発生しました:', error);
  }
}

// ローカルデータの読み込み
function loadLocalData() {
  try {
    if (fs.existsSync(USERS_DATA_FILE)) {
      const data = fs.readFileSync(USERS_DATA_FILE, 'utf8');
      userDataCache = JSON.parse(data);
      console.log('ローカルデータをロードしました');
    }
  } catch (error) {
    console.error('ローカルデータの読み込み中にエラーが発生しました:', error);
    userDataCache = {};
  }
}

// アプリケーション起動時にローカルデータを読み込む
loadLocalData();

// スプレッドシートサービス
const sheetsService = {
  /**
   * Google Apps Scriptを呼び出す共通関数
   * @param {string} functionName - 呼び出す関数名
   * @param {Array} parameters - 関数パラメータ
   * @returns {Promise<any>} レスポンスデータ
   */
  async callGoogleAppsScript(functionName, parameters) {
    try {
      console.log(`Google Apps Script 呼び出し: ${functionName}`, parameters);
      
      const response = await axios.post(
        `${GOOGLE_API_URL}?scriptId=${SCRIPT_ID}`,
        {
          function: functionName,
          parameters: parameters,
          devMode: false
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.error) {
        throw new Error(`API エラー: ${response.data.error.message}`);
      }
      
      return response.data.response ? response.data.response.result : null;
    } catch (error) {
      console.error(`Google Apps Script 呼び出しエラー (${functionName}): ${error.message}`);
      
      // 開発モードまたはネットワークエラーの場合はローカルデータを使用
      if (process.env.NODE_ENV === 'development' || error.code === 'ECONNREFUSED') {
        console.log('ローカルフォールバックモード');
        return null;
      }
      
      throw error;
    }
  },
  
  /**
   * ユーザーデータを取得する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object|null>} ユーザーデータまたはnull
   */
  async getUserData(guildId, userId) {
    try {
      // キャッシュが新鮮であれば、キャッシュから返す
      const cacheKey = `${guildId}_${userId}`;
      const now = Date.now();
      
      if (lastCacheUpdate && (now - lastCacheUpdate < CACHE_TTL) && userDataCache[cacheKey]) {
        return userDataCache[cacheKey];
      }
      
      const userData = await this.callGoogleAppsScript('getUserData', [guildId, userId]);
      
      if (userData) {
        // キャッシュに保存
        userDataCache[cacheKey] = userData;
        lastCacheUpdate = now;
      }
      
      return userData;
    } catch (error) {
      console.error(`ユーザーデータの取得中にエラーが発生しました: ${error.message}`);
      return null;
    }
  },
  
  /**
   * ユーザーデータを保存する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {Object} userData - ユーザーデータ
   * @returns {Promise<boolean>} 保存成功の場合true
   */
  async saveUserData(guildId, userId, userData) {
    try {
      await this.callGoogleAppsScript('saveUserData', [guildId, userId, userData]);
      
      // ローカルデータも更新（開発モード時のみ）
      if (process.env.NODE_ENV === 'development') {
        this.saveLocalUserData(guildId, userId, userData);
      }
      
      return true;
    } catch (error) {
      console.error(`ユーザーデータの保存エラー: ${error.message}`);
      
      // 開発モードまたはネットワークエラーの場合はローカルデータを保存
      if (process.env.NODE_ENV === 'development' || error.code === 'ECONNREFUSED') {
        console.log('ローカルデータを保存します');
        return this.saveLocalUserData(guildId, userId, userData);
      }
      
      throw error;
    }
  },
  
  /**
   * ポイント履歴を追加する
   * @param {Object} historyData - 履歴データ
   * @returns {Promise<{success: boolean, error: string|null}>} 保存結果
   */
  async addPointsHistory(historyData) {
    try {
      const { guildId, userId, pointsChange, newTotal, reason, timestamp } = historyData;
      
      await this.callGoogleAppsScript('logPointsHistory', [
        guildId, 
        userId, 
        pointsChange, 
        reason, 
        timestamp || new Date().toISOString()
      ]);
      
      return { success: true, error: null };
    } catch (error) {
      console.error(`ポイント履歴の追加中にエラーが発生しました: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * ポイント履歴を記録する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {number} pointsChange - ポイント変更量
   * @param {number} newTotal - 新しい合計ポイント
   * @param {string} reason - 理由
   * @param {Date} timestamp - タイムスタンプ
   * @returns {Promise<{success: boolean, error: string|null}>} 結果
   */
  async logPointsHistory(guildId, userId, pointsChange, newTotal, reason = '', timestamp = new Date()) {
    try {
      console.log(`履歴記録: ギルド ${guildId}, ユーザー ${userId}, 変更: ${pointsChange}, 新合計: ${newTotal}, 理由: ${reason}`);
      
      // Google Apps Scriptにリクエスト送信
      const response = await this.callGoogleAppsScript('logPointsHistory', [
        guildId,
        userId,
        pointsChange,
        newTotal,
        reason,
        timestamp.toISOString()
      ]);
      
      if (response) {
        console.log(`ポイント履歴の記録に成功しました: ${userId}`);
        return { success: true };
      } else {
        throw new Error('ポイント履歴の記録に失敗しました');
      }
    } catch (error) {
      console.error(`ポイント履歴の記録中にエラーが発生しました: ${error.message}`);
      throw error;
    }
  },

  /**
   * ユーザーのポイントを更新する
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {number} newPoints - 新しいポイント数
   * @returns {Promise<{success: boolean, error: string|null}>} 結果
   */
  async updatePoints(guildId, userId, newPoints) {
    try {
      // ユーザーデータを取得
      const userData = await this.getUserData(guildId, userId);
      if (!userData) {
        return { success: false, error: 'ユーザーデータが見つかりません' };
      }
      
      // ポイントを更新
      userData.points = newPoints;
      
      // データを保存
      await this.saveUserData(guildId, userId, userData);
      
      return { success: true, error: null };
    } catch (error) {
      console.error(`ポイント更新エラー: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * ローカルユーザーデータを取得する（開発モード用）
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @returns {Object|null} ユーザーデータまたはnull
   */
  getLocalUserData(guildId, userId) {
    // ローカルの保存先
    const localDataDir = path.join(__dirname, '../../data');
    const userDataFile = path.join(localDataDir, `${guildId}_${userId}.json`);
    
    try {
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      
      // ファイルが存在しない場合はnullを返す
      if (!fs.existsSync(userDataFile)) {
        return null;
      }
      
      // ファイルを読み込む
      const fileData = fs.readFileSync(userDataFile, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error(`ローカルデータ読み込みエラー: ${error.message}`);
      return null;
    }
  },
  
  /**
   * ローカルユーザーデータを保存する（開発モード用）
   * @param {string} guildId - サーバーID
   * @param {string} userId - ユーザーID
   * @param {Object} userData - ユーザーデータ
   * @returns {boolean} 保存成功の場合true
   */
  saveLocalUserData(guildId, userId, userData) {
    // ローカルデータの保存を一時的に無効化
    return true;
    
    /* 以下のコードは一時的に無効化
    const localDataDir = path.join(__dirname, '../../data');
    const userDataFile = path.join(localDataDir, `${guildId}_${userId}.json`);
    
    try {
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      
      // JSONとして保存
      fs.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
      return true;
    } catch (error) {
      console.error(`ローカルデータ保存エラー: ${error.message}`);
      return false;
    }
    */
  }
};

/**
 * ポイント履歴をスプレッドシートに記録する
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {number} pointsChange ポイント変更量
 * @param {number} newTotal 新しい合計ポイント
 * @param {string} reason 理由
 * @param {string} timestamp タイムスタンプ（省略可）
 * @returns {Promise<{success: boolean, error: string|null}>} 結果
 */
async function addPointsHistory(guildId, userId, pointsChange, newTotal, reason, timestamp = new Date().toISOString()) {
  try {
    console.log(`ポイント履歴記録: ${guildId}, ${userId}, ${pointsChange}, ${reason}`);
    
    // スプレッドシートドキュメントを初期化
    const doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 'PointsHistory' シートを取得または作成
    let sheet = doc.getSheetByName('PointsHistory');
    if (!sheet) {
      sheet = doc.insertSheet('PointsHistory');
      // ヘッダー行を追加
      sheet.appendRow(['Timestamp', 'GuildID', 'UserID', 'PointsChange', 'NewTotal', 'Reason']);
    }
    
    // 日付をフォーマット
    const formattedDate = new Date(timestamp).toLocaleString('ja-JP');
    
    // 新しい行を追加
    sheet.appendRow([formattedDate, guildId, userId, pointsChange, newTotal, reason]);
    
    console.log('ポイント履歴を記録しました');
    return { success: true, error: null };
  } catch (error) {
    console.error(`ポイント履歴記録エラー: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { 
  sheetsService,
  addPointsHistory
}; 