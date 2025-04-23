const { google } = require('googleapis');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Google Sheets APIのURLを設定
const API_URL = process.env.GOOGLE_SHEETS_API_URL;

// ローカルストレージのパス
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../data');
const USER_DATA_FILE = path.join(LOCAL_STORAGE_DIR, 'userData.json');

// ローカルストレージの初期化
function initLocalStorage() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    try {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
      console.log('ローカルストレージディレクトリを作成しました:', LOCAL_STORAGE_DIR);
    } catch (error) {
      console.error('ローカルストレージディレクトリの作成に失敗しました:', error);
    }
  }
  
  if (!fs.existsSync(USER_DATA_FILE)) {
    try {
      fs.writeFileSync(USER_DATA_FILE, JSON.stringify([]));
      console.log('ユーザーデータファイルを初期化しました:', USER_DATA_FILE);
    } catch (error) {
      console.error('ユーザーデータファイルの初期化に失敗しました:', error);
    }
  }
}

// ローカルストレージからユーザーデータを取得
function getLocalUserData(guildId, userId) {
  try {
    if (!fs.existsSync(USER_DATA_FILE)) {
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    return data.find(user => user.guildId === guildId && user.userId === userId) || null;
  } catch (error) {
    console.error('ローカルストレージからのユーザーデータ取得に失敗しました:', error);
    return null;
  }
}

// ローカルストレージにユーザーデータを保存
function saveLocalUserData(userData) {
  try {
    let data = [];
    
    if (fs.existsSync(USER_DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
    }
    
    const index = data.findIndex(user => 
      user.guildId === userData.guildId && user.userId === userData.userId
    );
    
    if (index !== -1) {
      data[index] = userData;
    } else {
      data.push(userData);
    }
    
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2));
    return userData;
  } catch (error) {
    console.error('ローカルストレージへのユーザーデータ保存に失敗しました:', error);
    throw error;
  }
}

// ローカルストレージの初期化
initLocalStorage();

/**
 * ユーザーデータをスプレッドシートから取得
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @returns {Promise<Object|null>} ユーザーデータ
 */
async function getUserData(guildId, userId) {
  try {
    if (!API_URL) {
      console.error('GOOGLE_SHEETS_API_URLが設定されていません');
      // ローカルストレージからユーザーデータを取得
      console.log('ローカルストレージからユーザーデータを取得します');
      return getLocalUserData(guildId, userId);
    }

    const url = `${API_URL}?action=getUserData&guildId=${guildId}&userId=${userId}`;
    console.log('ユーザーデータ取得リクエスト:', url);
    
    const response = await fetch(url);
    console.log('ユーザーデータ取得レスポンスステータス:', response.status);
    
    if (!response.ok) {
      console.error(`APIエラー: ${response.status} ${response.statusText}`);
      // ローカルストレージからユーザーデータを取得
      console.log('ローカルストレージからユーザーデータを取得します');
      return getLocalUserData(guildId, userId);
    }
    
    const resultText = await response.text();
    console.log('ユーザーデータ取得レスポンス本文:', resultText);
    
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (e) {
      console.error('レスポンスのJSON解析に失敗しました:', e, 'レスポンス:', resultText);
      // ローカルストレージからユーザーデータを取得
      console.log('ローカルストレージからユーザーデータを取得します');
      return getLocalUserData(guildId, userId);
    }
    
    if (!result.success) {
      console.error('ユーザーデータの取得中にAPIエラーが発生しました:', result.error);
      // ローカルストレージからユーザーデータを取得
      console.log('ローカルストレージからユーザーデータを取得します');
      return getLocalUserData(guildId, userId);
    }
    
    return result.data;
  } catch (error) {
    console.error('ユーザーデータの取得中にエラーが発生しました:', error);
    // ローカルストレージからユーザーデータを取得
    console.log('ローカルストレージからユーザーデータを取得します');
    return getLocalUserData(guildId, userId);
  }
}

/**
 * ユーザーデータをスプレッドシートに保存
 * @param {Object} userData ユーザーデータ
 * @returns {Promise<void>}
 */
async function saveUserData(userData) {
  try {
    // まずローカルストレージに保存（バックアップ用）
    saveLocalUserData(userData);
    
    if (!API_URL) {
      console.error('GOOGLE_SHEETS_API_URLが設定されていません');
      console.log('ローカルストレージにのみ保存しました');
      return userData;
    }

    console.log('ユーザーデータ保存リクエスト:', userData);
    
    const response = await fetch(`${API_URL}?action=saveUserData`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `userData=${encodeURIComponent(JSON.stringify(userData))}`,
    });
    
    console.log('ユーザーデータ保存レスポンスステータス:', response.status);
    
    if (!response.ok) {
      console.error(`APIエラー: ${response.status} ${response.statusText}`);
      console.log('APIエラーが発生しましたが、ローカルストレージには保存されています');
      return userData;
    }
    
    const resultText = await response.text();
    console.log('ユーザーデータ保存レスポンス本文:', resultText);
    
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (e) {
      console.error('レスポンスのJSON解析に失敗しました:', e, 'レスポンス:', resultText);
      console.log('APIレスポンスの解析に失敗しましたが、ローカルストレージには保存されています');
      return userData;
    }
    
    if (!result.success) {
      console.error('ユーザーデータの保存中にAPIエラーが発生しました:', result.error);
      console.log('APIエラーが発生しましたが、ローカルストレージには保存されています');
      return userData;
    }
    
    return result.data;
  } catch (error) {
    console.error('ユーザーデータの保存中にエラーが発生しました:', error);
    console.log('エラーが発生しましたが、ローカルストレージには保存されています');
    return userData;
  }
}

/**
 * イベント参加履歴を記録
 * @param {string} guildId サーバーID
 * @param {string} userId ユーザーID
 * @param {string} eventName イベント名
 * @param {number} bonusPoints 付与されたボーナスポイント
 * @returns {Promise<void>}
 */
async function logEventParticipation(guildId, userId, eventName, bonusPoints) {
  try {
    const response = await fetch(`${API_URL}?action=logEventParticipation&guildId=${guildId}&userId=${userId}&eventName=${encodeURIComponent(eventName)}&bonusPoints=${bonusPoints}`);
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('イベント参加履歴の記録中にエラーが発生しました:', result.error);
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('イベント参加履歴の記録中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * サーバー内のランキングを取得
 * @param {string} guildId サーバーID
 * @param {number} limit 取得するランキングの上限（デフォルト10）
 * @returns {Promise<Array>} ランキングデータ
 */
async function getServerRanking(guildId, limit = 10) {
  try {
    const response = await fetch(`${API_URL}?action=getServerRanking&guildId=${guildId}&limit=${limit}`);
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('サーバーランキングの取得中にエラーが発生しました:', result.error);
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('サーバーランキングの取得中にエラーが発生しました:', error);
    throw error;
  }
}

module.exports = {
  getUserData,
  saveUserData,
  logEventParticipation,
  getServerRanking,
  getLocalUserData,
  saveLocalUserData
}; 