/** Dear Guest専用。メール・カウントダウン・謎の公開日時には影響しません。 */
function setupDearGuestSettings() {
  assertDedicatedExecutionAccount_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(PUZZLE_SETTINGS_SHEET);
    if (!sheet) throw new Error('先にsetupLastPuzzleを実行してください。');
    const range = sheet.getRange('A3:C4');
    const existing = range.getValues();
    if (existing.every(row => row.every(value => value === ''))) {
      range.setValues([
        ['Dear Guest 結婚式開始日時', new Date(APP_CONFIG.weddingDateIso), 'Dear Guest専用。前日・当日は日本時間の日付で判定。テスト時も変更できます。'],
        ['Dear Guest 結婚式終了日時', new Date(APP_CONFIG.receptionEndIso), 'この日時以降は結婚式後の文章。開始日時より後に設定してください。メール送信日時には影響しません。']
      ]);
      sheet.getRange('B3:B4').setNumberFormat('yyyy/mm/dd hh:mm').setNote('日本時間。例：2027/03/21 10:00。編集後は招待状を再読込、または通常30秒以内に反映。空欄・不正な日時・終了≦開始の場合は開催前の通常文を表示します。');
      range.setWrap(true);
      sheet.autoResizeRows(3, 2);
    } else if (existing[0][0] !== 'Dear Guest 結婚式開始日時' || existing[1][0] !== 'Dear Guest 結婚式終了日時') {
      throw new Error('公開設定A3:C4に既存の設定があります。上書きせず終了しました。');
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
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
  const sheet = book.getSheetByName(PUZZLE_SETTINGS_SHEET);
  const values = sheet ? sheet.getRange('B3:B4').getValues() : [];
  const start = puzzleReleaseDate_(values[0] && values[0][0]);
  const end = puzzleReleaseDate_(values[1] && values[1][0]);
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
