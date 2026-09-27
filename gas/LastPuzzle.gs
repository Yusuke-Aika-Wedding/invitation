/** 公開日時は「公開設定」のDear Guest 結婚式終了日時（日本時間）です。 */
const PUZZLE_SETTINGS_SHEET = '公開設定';
const THANKS_VISITS_SHEET = '来場感謝サイト訪問記録';
const THANKS_VISIT_HEADERS = ['訪問日時', 'ID', 'ゲスト名', '入力された合言葉', '紐付け方法', '訪問ID'];

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (!params.action || params.action === 'status') {
      const result = getStatus_(params.guestId);
      result.dearGuest = getDearGuestState_(result.guestId);
      return output_(result, params.callback);
    }
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
      sheet.getRange('A1:C3').setValues([
        ['設定項目', '設定値（日本時間）', '説明'],
        ['Dear Guest 結婚式開始日時', new Date(APP_CONFIG.weddingDateIso), 'Dear Guestの切替とCountdownの終了・非表示に使用します。'],
        ['Dear Guest 結婚式終了日時', new Date(APP_CONFIG.receptionEndIso), 'Dear Guestの切替、The Last Puzzleと来場感謝サイトの公開に使用します。空欄は非公開。']
      ]);
      sheet.getRange('B2:B3').setNumberFormat('yyyy/mm/dd hh:mm');
      sheet.getRange('B2:B3').setNote('日本時間。編集後は通常30秒以内に反映します。メール送信日時には影響しません。');
      sheet.getRange('A1:C1').setBackground('#eeeeee').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 245);
      sheet.setColumnWidth(2, 210);
      sheet.setColumnWidth(3, 460);
      sheet.getRange('A2:C3').setWrap(true);
    }
    if (!book.getSheetByName(THANKS_VISITS_SHEET)) {
      const sheet = book.insertSheet(THANKS_VISITS_SHEET);
      sheet.getRange(1, 1, 1, THANKS_VISIT_HEADERS.length).setValues([THANKS_VISIT_HEADERS]).setBackground('#eeeeee').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, 5, 180);
      sheet.setColumnWidth(5, 260);
      sheet.setColumnWidth(6, 310);
      sheet.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm:ss');
      sheet.getRange('B1').setNote('同じタブで直前に認証したIDです。本人確認・来場証明ではありません。認証履歴がない場合はID入力後に記録します。');
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
  const record = guestId ? findGuestRecord_(getMainSheet_(), guestId) : null;
  if (!record) throw new Error('ゲスト情報が見つかりません。');
  const { start, end: release } = getWeddingSchedule_();
  const now = new Date();
  const published = Boolean(release && now.getTime() >= release.getTime());
  const response = { ok: true, startAt: start ? start.toISOString() : '', published: published, releaseAt: release ? release.toISOString() : '', serverTime: now.toISOString(), dearGuest: getDearGuestState_(guestId, now), invitationMessage: record.values.invitationMessage || '' };
  const visitSheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(THANKS_VISITS_SHEET);
  const visits = visitSheet && visitSheet.getLastRow() > 1 ? visitSheet.getRange(2, 1, visitSheet.getLastRow() - 1, 6).getValues() : [];
  const visitIndex = visits.findIndex(row => String(row[1]) === String(record.values.id) && row[5]);
  response.solved = visitIndex !== -1;
  response.rank = response.solved ? thanksVisitRank_(visits, visitIndex) : null;
  if (published) {
    response.examples = [
      { name: '白戸祐輔 の場合', code: 'ww5jg4ww9cxE → baseball' },
      { name: '大貫愛佳 の場合', code: 'za3njBfcDrl8 → clarinet' }
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
  const guestId = normalizeGuestId_(params.guestId);
  const record = guestId ? findGuestRecord_(getMainSheet_(), guestId) : null;
  if (!record) {
    const { end } = getWeddingSchedule_();
    return { ok: false, needsGuestId: true, published: Boolean(end && Date.now() >= end.getTime()) };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId).getSheetByName(THANKS_VISITS_SHEET);
    if (!sheet) throw new Error('訪問記録の準備ができていません。');
    const lastRow = sheet.getLastRow();
    const visits = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 6).getValues() : [];
    const existingIndex = visits.findIndex(row => String(row[5]) === eventId);
    if (existingIndex !== -1) {
      if (String(visits[existingIndex][1]) !== String(record.values.id)) return { ok: false, retryWithNewEvent: true };
      return thanksVisitResult_(visits, existingIndex);
    }
    const safeText = value => /^[=+@-]/.test(String(value)) ? "'" + value : String(value);
    const newVisit = [
      new Date(), safeText(record.values.id), safeText(record.values.name || ''),
      keyword, '確認済みのゲストID', eventId
    ];
    sheet.appendRow(newVisit);
    visits.push(newVisit);
    SpreadsheetApp.flush();
    return thanksVisitResult_(visits, visits.length - 1);
  } finally {
    lock.releaseLock();
  }
}

// 同じゲストの再訪は初回順位を返す。ID不明の訪問は訪問ID単位で数える。
// シートの追記順を正解到達順とし、読み取りから追記まで同じロック内で処理する。
function thanksVisitRank_(visits, targetIndex) {
  const ranks = new Map();
  for (let index = 0; index <= targetIndex; index += 1) {
    const row = visits[index];
    const id = String(row[1] || '');
    const eventId = String(row[5] || '');
    if (!eventId) continue;
    const key = id && id !== 'ID不明' ? 'guest:' + id : 'visit:' + eventId;
    if (!ranks.has(key)) ranks.set(key, ranks.size + 1);
    if (index === targetIndex) return ranks.get(key);
  }
  throw new Error('解答順位を確認できませんでした。');
}

// 公開前の解答も先に記録する。再訪時は同じゲストの初回到達日時で判定する。
function thanksVisitResult_(visits, targetIndex) {
  const target = visits[targetIndex];
  const id = String(target[1] || '');
  const first = id && id !== 'ID不明' ? visits.find(row => String(row[1]) === id && row[5]) : target;
  const { end } = getWeddingSchedule_();
  const now = new Date();
  const solvedAt = puzzleReleaseDate_(first[0]);
  return {
    ok: true, recorded: true, rank: thanksVisitRank_(visits, targetIndex),
    published: Boolean(end && now.getTime() >= end.getTime()),
    earlySolved: Boolean(end && solvedAt && solvedAt.getTime() < end.getTime()),
    releaseAt: end ? end.toISOString() : '', serverTime: now.toISOString()
  };
}
