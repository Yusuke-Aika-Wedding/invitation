/** 公開日時は「公開設定」B2（日本時間）で変更できます。 */
const PUZZLE_SETTINGS_SHEET = '公開設定';
const THANKS_VISITS_SHEET = '来場感謝サイト訪問記録';
const THANKS_VISIT_HEADERS = ['訪問日時', 'ID', 'ゲスト名', '入力された合言葉', '紐付け方法', '訪問ID'];

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.action === 'lastPuzzle') return output_(getLastPuzzle_(params.guestId), params.callback);
    if (params.action === 'recordThanksVisit') return output_(recordThanksVisit_(params), params.callback);
    return doGetInvitation_(e);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return output_({ ok: false, error: error.message || String(error) }, params.callback);
  }
}

// 初回のみ実行。既存のゲスト、出欠、投票、メールトリガーは変更しません。
function setupLastPuzzle() {
  assertDedicatedExecutionAccount_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
    if (!book.getSheetByName(PUZZLE_SETTINGS_SHEET)) {
      const sheet = book.insertSheet(PUZZLE_SETTINGS_SHEET);
      sheet.getRange('A1:C2').setValues([
        ['設定項目', '設定値（日本時間）', '説明'],
        ['The Last Puzzle公開日時', new Date('2026-09-19T09:00:00+09:00'), 'B2の日時を変更すると、開いているページにも通常30秒以内に反映します。空欄は非公開。']
      ]);
      sheet.getRange('B2').setNumberFormat('yyyy/mm/dd hh:mm');
      sheet.getRange('B2').setNote('日本時間。例：2026/09/19 09:00。空欄にすると非公開になります。');
      sheet.getRange('A1:C1').setBackground('#eeeeee').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 245);
      sheet.setColumnWidth(2, 210);
      sheet.setColumnWidth(3, 460);
      sheet.getRange('C2').setWrap(true);
    }
    if (!book.getSheetByName(THANKS_VISITS_SHEET)) {
      const sheet = book.insertSheet(THANKS_VISITS_SHEET);
      sheet.getRange(1, 1, 1, THANKS_VISIT_HEADERS.length).setValues([THANKS_VISIT_HEADERS]).setBackground('#eeeeee').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, 5, 180);
      sheet.setColumnWidth(5, 260);
      sheet.setColumnWidth(6, 310);
      sheet.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm:ss');
      sheet.getRange('B1').setNote('同じタブで直前に認証したIDです。本人確認・来場証明ではありません。認証履歴がない場合はID不明。');
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function puzzleReleaseDate_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(text)) {
    try { return Utilities.parseDate(text, APP_CONFIG.timeZone, 'yyyy/MM/dd HH:mm'); } catch (_) { return null; }
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

function getLastPuzzle_(guestIdRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  if (!guestId || !findGuestRecord_(getMainSheet_(), guestId)) throw new Error('ゲスト情報が見つかりません。');
  const sheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(PUZZLE_SETTINGS_SHEET);
  const release = sheet ? puzzleReleaseDate_(sheet.getRange('B2').getValue()) : null;
  const now = new Date();
  const published = Boolean(release && now.getTime() >= release.getTime());
  const response = { ok: true, published: published, releaseAt: release ? release.toISOString() : '', serverTime: now.toISOString() };
  if (published) {
    response.examples = [
      { name: '白戸祐輔のとき', code: 'wwjgwwcx → baseball' },
      { name: '大貫愛佳のとき', code: 'zanjfcrl → clarinet' }
    ];
    response.question = 'では、あなたは？';
  }
  return response;
}

function recordThanksVisit_(params) {
  const keyword = String(params.keyword || '').replace(/\s+/g, '').toLowerCase();
  if (['thanks', 'thankyou', 'manythanks'].indexOf(keyword) === -1) throw new Error('合言葉を確認してください。');
  const eventId = String(params.eventId || '');
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(eventId)) throw new Error('訪問IDが不正です。');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(THANKS_VISITS_SHEET);
    if (!sheet) throw new Error('訪問記録の準備ができていません。');
    const lastRow = sheet.getLastRow();
    if (lastRow > 1 && sheet.getRange(2, 6, lastRow - 1, 1).getValues().some(row => String(row[0]) === eventId)) {
      return { ok: true, recorded: true };
    }
    const guestId = normalizeGuestId_(params.guestId);
    const record = guestId ? findGuestRecord_(getMainSheet_(), guestId) : null;
    const safeText = value => /^[=+@-]/.test(String(value)) ? "'" + value : String(value);
    sheet.appendRow([
      new Date(), record ? safeText(record.values.id) : 'ID不明', record ? safeText(record.values.name || '') : '',
      keyword, record ? '直前の認証ID（同じブラウザ）' : '認証履歴なし／照合不可', eventId
    ]);
    SpreadsheetApp.flush();
    return { ok: true, recorded: true };
  } finally {
    lock.releaseLock();
  }
}
