/** 開始・終了日時は公開設定の項目名で参照します。メール送信日時は変更しません。 */
function setupDearGuestSettings() {
  setupLastPuzzle();
}

function getWeddingSchedule_() {
  const sheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(PUZZLE_SETTINGS_SHEET);
  const rows = sheet && sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
  const read = name => {
    const row = rows.find(row => row[0] === name);
    return puzzleReleaseDate_(row && row[1]);
  };
  return { start: read('Dear Guest 結婚式開始日時'), end: read('Dear Guest 結婚式終了日時') };
}

function dearGuestPhase_(now, start, end) {
  if (!start || !end || end.getTime() <= start.getTime()) return 'early';
  if (now.getTime() >= end.getTime()) return 'after';
  if (now.getTime() >= start.getTime()) return 'during';
  // 日本時間の暦日差。24時間未満かどうかでは判定しません。
  const day = date => Math.floor((date.getTime() + 9 * 60 * 60 * 1000) / 86400000);
  const days = day(start) - day(now);
  return days === 0 ? 'today' : days === 1 ? 'eve' : 'early';
}

function getDearGuestState_(guestId, now) {
  const book = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  const { start, end } = getWeddingSchedule_();
  const phase = dearGuestPhase_(now || new Date(), start, end);
  let thanksVisited = false;
  if (phase === 'after') {
    const visits = book.getSheetByName(THANKS_VISITS_SHEET);
    if (visits && visits.getLastRow() > 1) {
      thanksVisited = visits.getRange(2, 2, visits.getLastRow() - 1, 1).getValues()
        .some(row => String(row[0]) === guestId);
    }
  }
  return { phase: phase, thanksVisited: thanksVisited, settingsValid: Boolean(start && end && end.getTime() > start.getTime()) };
}
