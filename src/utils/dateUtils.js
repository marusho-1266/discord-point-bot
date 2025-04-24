/**
 * 日付・時刻に関するユーティリティ関数
 */

/**
 * タイムスタンプを日本語フォーマットに変換する
 * @param {Date|string} timestamp - 日付オブジェクトまたはISO形式の日付文字列
 * @param {boolean} includeTime - 時刻も含めるかどうか（デフォルトはtrue）
 * @returns {string} フォーマットされた日付文字列
 */
function formatTimestamp(timestamp, includeTime = true) {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    // 日付が不正な場合
    if (isNaN(date.getTime())) {
      return '無効な日付';
    }
    
    // 日付部分のフォーマット（yyyy年MM月dd日）
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}年${month}月${day}日`;
    
    if (!includeTime) {
      return dateStr;
    }
    
    // 時刻部分のフォーマット（HH:mm:ss）
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    
    return `${dateStr} ${timeStr}`;
  } catch (error) {
    console.error('日付フォーマットエラー:', error);
    return '日付エラー';
  }
}

/**
 * 現在の日付を日本語フォーマットで取得する
 * @param {boolean} includeTime - 時刻も含めるかどうか
 * @returns {string} フォーマットされた現在日時
 */
function getCurrentDateTime(includeTime = true) {
  return formatTimestamp(new Date(), includeTime);
}

/**
 * 日付が同じ日かどうかを判定する
 * @param {Date|string} date1 - 比較する日付1
 * @param {Date|string} date2 - 比較する日付2
 * @returns {boolean} 同じ日であればtrue
 */
function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * 2つの日付の日数差を計算する
 * @param {Date|string} date1 - 日付1
 * @param {Date|string} date2 - 日付2
 * @returns {number} 日数差（整数）
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // 時間部分を切り捨てて純粋な日付の差を計算
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  formatTimestamp,
  getCurrentDateTime,
  isSameDay,
  getDaysDifference
}; 