/**
 * Yusuke & Aika Wedding Invitation Backend
 *
 * GitHub PagesからJSONPで呼び出すGoogle Apps Scriptです。
 * スプレッドシート列：
 * A ID / B ゲスト名 / C メールアドレス / D 挙式出欠 / E 披露宴出欠 / F アレルギー
 * G 回答日時 / H 確認メール送信日時 / I 1週間前リマインド送信日時
 * J 前日リマインド送信日時 / K 更新日時 / L メッセージ
 * M 参加ありがとうメール送信日時 / N ご祝儀ステータス
 * O 送金方法 / P 送金元名義 / Q 送金についてのメモ / R 送金申告日時
 * S 送金申告通知メール送信日時 / T 着金確認日時 / U 着金確認メール送信日時
 * V 要確認メール送信日時 / W メール操作 / X ご祝儀管理メモ
 */

const APP_CONFIG = {
  spreadsheetId: '1micDJFsf6ktwZrq_tlIz9TiC4PjbBbv-7dlWgbhMjbs',
  sheetName: 'ゲスト一覧',
  timeZone: 'Asia/Tokyo',
  weddingDateYmd: '2027-03-21',
  weddingDateIso: '2027-03-21T10:00:00+09:00',
  receptionEndIso: '2027-03-21T14:00:00+09:00',
  weddingDateLabel: '2027年3月21日（日）',
  ceremonyTimeLabel: '10:00〜10:30',
  receptionTimeLabel: '11:00〜14:00',
  groomFullName: '白戸祐輔',
  brideFullName: '大貫愛佳',
  senderName: 'Yusuke & Aika Wedding',
  senderEmail: 'yusuke.aika.wedding@gmail.com',
  bccEmail: 'yusuke.aika.wedding@gmail.com',
  giftNotificationEmail: 'yusuke.aika.wedding@gmail.com',
  previewRecipientEmail: 'yusuke.tigers.0522@gmail.com',
  venueName: 'キンプトン新宿東京',
  venueUrl: 'https://www.kimptonshinjukuwedding.com/',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%B3%E3%83%97%E3%83%88%E3%83%B3%E6%96%B0%E5%AE%BF%E6%9D%B1%E4%BA%AC',
  baseInvitationUrl: 'https://Yusuke-Aika-Wedding.github.io/invitation/',
  reminderHour: 9,
  thanksHour: 15,
  batchEmailIntervalMs: 1000
};

const HEADERS = [
  'ID',
  'ゲスト名',
  'メールアドレス',
  '挙式出欠',
  '披露宴出欠',
  'アレルギー',
  '回答日時',
  '確認メール送信日時',
  '1週間前リマインド送信日時',
  '前日リマインド送信日時',
  '更新日時',
  'メッセージ',
  '参加ありがとうメール送信日時',
  'ご祝儀ステータス',
  '送金方法',
  '送金元名義',
  '送金についてのメモ',
  '送金申告日時',
  '送金申告通知メール送信日時',
  '着金確認日時',
  '着金確認メール送信日時',
  '要確認メール送信日時',
  'メール操作',
  'ご祝儀管理メモ'
];

const COL = {
  id: 1,
  name: 2,
  email: 3,
  ceremony: 4,
  reception: 5,
  allergy: 6,
  submittedAt: 7,
  confirmationSentAt: 8,
  reminder7SentAt: 9,
  reminder1SentAt: 10,
  updatedAt: 11,
  message: 12,
  thanksSentAt: 13,
  giftStatus: 14,
  giftMethod: 15,
  giftSenderName: 16,
  giftDeclarationNote: 17,
  giftReportedAt: 18,
  giftHostNotifiedAt: 19,
  giftConfirmedAt: 20,
  giftConfirmationSentAt: 21,
  giftIssueSentAt: 22,
  giftAction: 23,
  giftAdminNote: 24
};

const GIFT_STATUS = {
  unsent: '未送金',
  reported: '確認待ち',
  confirmed: '着金確認済み',
  issue: '要確認',
  cash: '現金'
};

const LEGACY_GIFT_STATUS = {
  '未入金': GIFT_STATUS.unsent,
  '入金済み': GIFT_STATUS.reported,
  '送金済み': GIFT_STATUS.reported,
  '再入金': GIFT_STATUS.issue,
  '再送金': GIFT_STATUS.issue
};

const GIFT_ACTION = {
  confirm: '着金確認メールを送る',
  issue: '送金状況確認メールを送る'
};

const GIFT_METHOD_LABELS = {
  yucho: 'ことら送金（ゆうちょ銀行）',
  rakuten: '銀行振込（楽天銀行）',
  paypay: 'PayPay',
  unknown: '未記録',
  cash: '当日に現金'
};

// 正式な送金先はGASのスクリプト プロパティ「GIFT_INFO_JSON」へ保存します。
// 未設定の間は、以下のプレースホルダーだけをゲスト画面へ返します。
const PLACEHOLDER_GIFT_INFORMATION = {
  yucho: {
    bankName: 'ゆうちょ銀行',
    bankCode: '9900',
    branchName: '〇〇八',
    branchCode: '0XX',
    accountType: '普通',
    accountNumber: 'XXXXXXX',
    holderKana: 'XXXXXXXX',
    symbol: 'XXXXX',
    number: 'XXXXXXXX'
  },
  rakuten: {
    bankName: '楽天銀行',
    bankCode: '0036',
    branchName: '〇〇支店',
    branchCode: 'XXX',
    accountType: '普通',
    accountNumber: 'XXXXXXX',
    holderKana: 'XXXXXXXX'
  },
  paypay: {
    paypayId: 'xxxxxxxx',
    displayName: 'XXXXXXXX'
  }
};

function setup() {
  assertDedicatedExecutionAccount_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    removeLegacyInvitationUrlColumn_(sheet);
    ensureHeaders_(sheet);
    ensureGiftStatusColumn_(sheet);
    ensureGiftActionColumn_(sheet);
    formatSheet_(sheet);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  resetTriggers_();
  Logger.log('Setup complete. Webアプリとしてデプロイし、URLをGitHub側の js/config.js に貼り付けてください。');
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    const action = params.action || 'status';
    if (action === 'ping') return output_({ ok: true, message: 'pong' }, params.callback);
    if (action === 'status') return output_(getStatus_(params.guestId), params.callback);
    if (action === 'submit') return output_(submitResponse_(params), params.callback);
    if (action === 'giftInfo') return output_(getGiftInformation_(params.guestId, params.method), params.callback);
    if (action === 'reportGiftSent') return output_(reportGiftSent_(params), params.callback);
    if (action === 'confirmGiftSent') {
      return output_(reportGiftSent_(Object.assign({}, params, { method: params.method || 'unknown' })), params.callback);
    }
    if (action === 'cancelGiftReport') return output_(cancelGiftReport_(params.guestId), params.callback);
    if (action === 'confirmGiftCash') return output_(confirmGiftCash_(params.guestId), params.callback);
    if (action === 'sendThanksNow') return output_({ ok: true, sent: sendAfterReceptionThanksEmails_(true) }, params.callback);
    return output_({ ok: false, error: 'Unknown action.' }, params.callback);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return output_({ ok: false, error: error.message || String(error) }, params.callback);
  }
}

function doPost(e) {
  try {
    const params = parsePostParams_(e);
    return output_(submitResponse_(params));
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return output_({ ok: false, error: error.message || String(error) });
  }
}

function getStatus_(guestIdRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  if (!guestId) throw new Error('guestIdがありません。');

  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const record = findGuestRecord_(sheet, guestId);
  if (!record) throw new Error('ゲスト情報が見つかりません。');

  const values = record.values;
  const completed = isCompleted_(values);
  const giftStatus = normalizeGiftStatus_(values.giftStatus);
  return {
    ok: true,
    guestId: values.id,
    displayName: values.name || 'ゲスト',
    completed: completed,
    attending: isAttending_(values.ceremony, values.reception),
    giftSent: isGiftLocked_(giftStatus),
    giftStatus: giftStatus,
    canShowGiftInformation: canShowGiftInformation_(giftStatus),
    canCancelGiftReport: giftStatus === GIFT_STATUS.reported,
    giftMethod: values.giftMethod || '',
    giftSenderName: values.giftSenderName || '',
    giftDeclarationNote: values.giftDeclarationNote || '',
    giftReportedAt: values.giftReportedAt ? formatDateTime_(values.giftReportedAt) : '',
    email: values.email || '',
    ceremonyAttendance: values.ceremony || '',
    receptionAttendance: values.reception || '',
    allergy: values.allergy || '',
    message: values.message || '',
    submittedAt: values.submittedAt ? formatDateTime_(values.submittedAt) : ''
  };
}

function submitResponse_(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const guestId = normalizeGuestId_(params.guestId);
    const name = String(params.name || '').trim();
    const email = String(params.email || '').trim();
    const ceremonyAttendance = normalizeAttendance_(params.ceremonyAttendance);
    const receptionAttendance = normalizeAttendance_(params.receptionAttendance);
    const allergyChoice = String(params.allergyChoice || '').trim();
    const allergyDetails = String(params.allergyDetails || '').trim();
    const message = String(params.message || '').trim();

    if (!guestId) throw new Error('guestIdがありません。');
    if (!name) throw new Error('氏名を入力してください。');
    if (name.length > 100) throw new Error('氏名は100文字以内で入力してください。');
    if (!isValidEmail_(email)) throw new Error('メールアドレスを確認してください。');
    if (!ceremonyAttendance) throw new Error('挙式の出欠を選択してください。');
    if (!receptionAttendance) throw new Error('披露宴の出欠を選択してください。');

    let allergy = '';
    if (allergyChoice === 'なし') {
      allergy = 'なし';
    } else if (allergyChoice === 'あり') {
      if (!allergyDetails) throw new Error('アレルギーの詳細を入力してください。');
      allergy = allergyDetails;
    } else {
      throw new Error('アレルギーの「あり」「なし」を選択してください。');
    }

    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');
    const storedGuestId = record.values.id || guestId;

    const now = new Date();
    const invitationUrl = getInvitationUrl_();
    sheet.getRange(record.rowNumber, 1, 1, HEADERS.length).setValues([[
      storedGuestId,
      name,
      email,
      ceremonyAttendance,
      receptionAttendance,
      allergy,
      now,
      record.values.confirmationSentAt || '',
      record.values.reminder7SentAt || '',
      record.values.reminder1SentAt || '',
      now,
      message,
      record.values.thanksSentAt || '',
      normalizeGiftStatus_(record.values.giftStatus),
      record.values.giftMethod || '',
      record.values.giftSenderName || '',
      record.values.giftDeclarationNote || '',
      record.values.giftReportedAt || '',
      record.values.giftHostNotifiedAt || '',
      record.values.giftConfirmedAt || '',
      record.values.giftConfirmationSentAt || '',
      record.values.giftIssueSentAt || '',
      '',
      record.values.giftAdminNote || ''
    ]]);

    sendConfirmationEmail_({
      to: email,
      name: name,
      ceremonyAttendance: ceremonyAttendance,
      receptionAttendance: receptionAttendance,
      allergy: allergy,
      message: message,
      invitationUrl: invitationUrl
    });

    const afterMail = new Date();
    sheet.getRange(record.rowNumber, COL.confirmationSentAt).setValue(afterMail);
    sheet.getRange(record.rowNumber, COL.updatedAt).setValue(afterMail);

    const giftStatus = normalizeGiftStatus_(record.values.giftStatus);
    return {
      ok: true,
      completed: true,
      attending: isAttending_(ceremonyAttendance, receptionAttendance),
      giftSent: isGiftLocked_(giftStatus),
      giftStatus: giftStatus,
      canShowGiftInformation: canShowGiftInformation_(giftStatus),
      canCancelGiftReport: giftStatus === GIFT_STATUS.reported,
      displayName: name
    };
  } finally {
    lock.releaseLock();
  }
}

function getGiftInformation_(guestIdRaw, methodRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  const method = String(methodRaw || '').trim().toLowerCase();
  if (!guestId) throw new Error('guestIdがありません。');
  if (!['yucho', 'rakuten', 'paypay', 'unknown'].includes(method)) throw new Error('送金方法を確認してください。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');
    assertGiftInformationAvailable_(record.values);

    return {
      ok: true,
      method: method,
      information: buildGiftInformationResponse_(method)
    };
  } finally {
    lock.releaseLock();
  }
}

function confirmGiftCash_(guestIdRaw) {
  return recordGiftCash_(guestIdRaw);
}

function reportGiftSent_(params) {
  const guestId = normalizeGuestId_(params && params.guestId);
  const method = String((params && params.method) || '').trim().toLowerCase();
  const senderName = String((params && params.senderName) || '').trim();
  const declarationNote = String((params && params.declarationNote) || '').trim();
  if (!guestId) throw new Error('guestIdがありません。');
  // `unknown` is accepted only for the legacy confirmGiftSent endpoint so that
  // guests with an older cached version of the invitation can still report safely.
  if (!['yucho', 'rakuten', 'paypay', 'unknown'].includes(method)) throw new Error('送金方法を確認してください。');
  if (senderName.length > 100) throw new Error('送金元のお名前は100文字以内で入力してください。');
  if (declarationNote.length > 200) throw new Error('送金についてのメモは200文字以内で入力してください。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');
    if (!isCompleted_(record.values) || !isAttending_(record.values.ceremony, record.values.reception)) {
      throw new Error('送金情報の確認対象ではありません。');
    }

    const giftStatus = normalizeGiftStatus_(record.values.giftStatus);
    if (giftStatus === GIFT_STATUS.reported) {
      return buildGiftStatusResponse_(giftStatus);
    }
    if (!canShowGiftInformation_(giftStatus)) throw new Error('ご祝儀のお渡し方法はすでに確定しています。');

    const now = new Date();
    sheet.getRange(record.rowNumber, COL.giftStatus).setValue(GIFT_STATUS.reported);
    sheet.getRange(record.rowNumber, COL.giftMethod).setValue(method);
    sheet.getRange(record.rowNumber, COL.giftSenderName).setValue(senderName);
    sheet.getRange(record.rowNumber, COL.giftDeclarationNote).setValue(declarationNote);
    sheet.getRange(record.rowNumber, COL.giftReportedAt).setValue(now);
    sheet.getRange(record.rowNumber, COL.giftHostNotifiedAt).clearContent();
    sheet.getRange(record.rowNumber, COL.giftConfirmedAt).clearContent();
    sheet.getRange(record.rowNumber, COL.giftConfirmationSentAt).clearContent();
    sheet.getRange(record.rowNumber, COL.giftIssueSentAt).clearContent();
    sheet.getRange(record.rowNumber, COL.giftAction).clearContent();
    sheet.getRange(record.rowNumber, COL.updatedAt).setValue(now);
    setGiftStatusCellStyle_(sheet, record.rowNumber, GIFT_STATUS.reported);
    SpreadsheetApp.flush();

    let hostNotified = false;
    try {
      sendGiftReportNotificationEmail_({
        to: APP_CONFIG.giftNotificationEmail,
        name: record.values.name || 'ゲスト',
        guestEmail: record.values.email || '',
        method: method,
        senderName: senderName,
        declarationNote: declarationNote,
        reportedAt: now,
        spreadsheetUrl: getSpreadsheetUrl_(sheet)
      });
      const notifiedAt = new Date();
      sheet.getRange(record.rowNumber, COL.giftHostNotifiedAt).setValue(notifiedAt);
      sheet.getRange(record.rowNumber, COL.giftAdminNote).setValue('送金申告通知メールを送信しました。');
      hostNotified = true;
    } catch (error) {
      sheet.getRange(record.rowNumber, COL.giftAdminNote)
        .setValue(`送金申告通知メールの送信に失敗しました。自動再送します: ${error.message || error}`);
      console.error(error && error.stack ? error.stack : error);
    }

    return Object.assign(buildGiftStatusResponse_(GIFT_STATUS.reported), { hostNotified: hostNotified });
  } finally {
    lock.releaseLock();
  }
}

function cancelGiftReport_(guestIdRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  if (!guestId) throw new Error('guestIdがありません。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');
    const giftStatus = normalizeGiftStatus_(record.values.giftStatus);
    if (giftStatus !== GIFT_STATUS.reported) throw new Error('送金完了の連絡は取り消せません。');

    const cancelledAt = new Date();
    const previousSummary = [
      record.values.giftMethod ? `方法: ${getGiftMethodLabel_(record.values.giftMethod)}` : '',
      record.values.giftSenderName ? `名義: ${record.values.giftSenderName}` : '',
      record.values.giftDeclarationNote ? `メモ: ${record.values.giftDeclarationNote}` : ''
    ].filter(Boolean).join(' / ');
    sheet.getRange(record.rowNumber, COL.giftStatus).setValue(GIFT_STATUS.unsent);
    sheet.getRange(record.rowNumber, COL.giftMethod, 1, 5).clearContent();
    sheet.getRange(record.rowNumber, COL.giftAction).clearContent();
    sheet.getRange(record.rowNumber, COL.updatedAt).setValue(cancelledAt);
    sheet.getRange(record.rowNumber, COL.giftAdminNote)
      .setValue(`ゲストが送金申告を取り消しました（${formatDateTime_(cancelledAt)}）${previousSummary ? ` / ${previousSummary}` : ''}`);
    setGiftStatusCellStyle_(sheet, record.rowNumber, GIFT_STATUS.unsent);
    SpreadsheetApp.flush();

    try {
      sendGiftReportCancellationNotificationEmail_({
        to: APP_CONFIG.giftNotificationEmail,
        name: record.values.name || 'ゲスト',
        guestEmail: record.values.email || '',
        previousSummary: previousSummary,
        cancelledAt: cancelledAt,
        spreadsheetUrl: getSpreadsheetUrl_(sheet)
      });
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
    }

    return buildGiftStatusResponse_(GIFT_STATUS.unsent);
  } finally {
    lock.releaseLock();
  }
}

function recordGiftCash_(guestIdRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  if (!guestId) throw new Error('guestIdがありません。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');
    if (!isCompleted_(record.values) || !isAttending_(record.values.ceremony, record.values.reception)) {
      throw new Error('送金情報の確認対象ではありません。');
    }
    const giftStatus = normalizeGiftStatus_(record.values.giftStatus);
    if (!canShowGiftInformation_(giftStatus)) throw new Error('ご祝儀のお渡し方法はすでに確定しています。');

    const now = new Date();
    sheet.getRange(record.rowNumber, COL.giftStatus).setValue(GIFT_STATUS.cash);
    sheet.getRange(record.rowNumber, COL.giftMethod).setValue('cash');
    sheet.getRange(record.rowNumber, COL.giftAction).clearContent();
    sheet.getRange(record.rowNumber, COL.updatedAt).setValue(now);
    setGiftStatusCellStyle_(sheet, record.rowNumber, GIFT_STATUS.cash);
    SpreadsheetApp.flush();
    return buildGiftStatusResponse_(GIFT_STATUS.cash);
  } finally {
    lock.releaseLock();
  }
}

function buildGiftStatusResponse_(giftStatusRaw) {
  const giftStatus = normalizeGiftStatus_(giftStatusRaw);
  return {
    ok: true,
    giftSent: isGiftLocked_(giftStatus),
    giftStatus: giftStatus,
    canShowGiftInformation: canShowGiftInformation_(giftStatus),
    canCancelGiftReport: giftStatus === GIFT_STATUS.reported
  };
}

function assertGiftInformationAvailable_(values) {
  if (!isCompleted_(values) || !isAttending_(values.ceremony, values.reception)) {
    throw new Error('送金情報の確認対象ではありません。');
  }
  if (!canShowGiftInformation_(values.giftStatus)) {
    throw new Error('ご祝儀のお渡し方法が確定済みのため、送金先情報は表示できません。');
  }
}

function buildGiftInformationResponse_(method) {
  const config = getGiftInformationConfig_();
  if (method === 'yucho') {
    return {
      title: 'ことら送金（ゆうちょ銀行）',
      description: 'ことら送金では、振込用の店名・預金種目・口座番号をご指定ください。',
      fields: [
        giftField_('金融機関名', config.yucho.bankName),
        giftField_('金融機関コード', config.yucho.bankCode),
        giftField_('店名', config.yucho.branchName),
        giftField_('店番', config.yucho.branchCode),
        giftField_('預金種目', config.yucho.accountType),
        giftField_('口座番号', config.yucho.accountNumber),
        giftField_('口座名義', config.yucho.holderKana),
        giftField_('記号（ゆうちょ間）', config.yucho.symbol),
        giftField_('番号（ゆうちょ間）', config.yucho.number)
      ],
      note: 'ことら送金は1件10万円以下です。送金前に表示された受取人名を必ずご確認ください。'
    };
  }
  if (method === 'rakuten') {
    return {
      title: '銀行振込（楽天銀行）',
      description: '銀行アプリやATMで、以下の振込先をご指定ください。',
      fields: [
        giftField_('金融機関名', config.rakuten.bankName),
        giftField_('銀行コード', config.rakuten.bankCode),
        giftField_('支店名', config.rakuten.branchName),
        giftField_('支店番号', config.rakuten.branchCode),
        giftField_('預金科目', config.rakuten.accountType),
        giftField_('口座番号', config.rakuten.accountNumber),
        giftField_('口座名義', config.rakuten.holderKana)
      ],
      note: '送金前に表示された受取人名を必ずご確認ください。振込手数料はご利用の金融機関により異なります。'
    };
  }
  return {
    title: 'PayPay',
    description: 'PayPayアプリの「送る」から、以下のPayPay IDを検索してください。',
    fields: [
      giftField_('PayPay ID', config.paypay.paypayId),
      giftField_('表示名', config.paypay.displayName)
    ],
    note: '送金前に、PayPayアプリに表示された名前を必ずご確認ください。'
  };
}

function getGiftInformationConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty('GIFT_INFO_JSON');
  if (!raw) return PLACEHOLDER_GIFT_INFORMATION;
  try {
    const stored = JSON.parse(raw);
    return {
      yucho: mergeGiftMethodConfig_(PLACEHOLDER_GIFT_INFORMATION.yucho, stored.yucho),
      rakuten: mergeGiftMethodConfig_(PLACEHOLDER_GIFT_INFORMATION.rakuten, stored.rakuten),
      paypay: mergeGiftMethodConfig_(PLACEHOLDER_GIFT_INFORMATION.paypay, stored.paypay)
    };
  } catch (error) {
    throw new Error('送金先情報の設定形式に誤りがあります。新郎新婦へお問い合わせください。');
  }
}

function mergeGiftMethodConfig_(fallback, stored) {
  const source = stored && typeof stored === 'object' ? stored : {};
  return Object.keys(fallback).reduce((result, key) => {
    const value = String(source[key] || '').trim();
    result[key] = value || fallback[key];
    return result;
  }, {});
}

function giftField_(label, value) {
  return { label: label, value: String(value || '') };
}

function sendReminderEmails() {
  const daysBefore = daysBeforeWedding_(new Date());
  if (![7, 1].includes(daysBefore)) {
    Logger.log(`Reminder skipped. daysBefore=${daysBefore}`);
    return;
  }
  sendReminderEmailsByDays_(daysBefore, false);
}

function testReminder7Days() {
  sendReminderEmailsByDays_(7, true);
}

function testReminder1Day() {
  sendReminderEmailsByDays_(1, true);
}

function sendReminderEmailsByDays_(daysBefore, isTest) {
  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const records = readRecords_(sheet);
  const sentColumn = daysBefore === 7 ? COL.reminder7SentAt : COL.reminder1SentAt;
  const sentKey = daysBefore === 7 ? 'reminder7SentAt' : 'reminder1SentAt';
  let sentCount = 0;

  records.forEach(record => {
    const v = record.values;
    if (!isCompleted_(v)) return;
    if (!isValidEmail_(v.email)) return;
    if (!isAttending_(v.ceremony, v.reception)) return;
    if (!isTest && v[sentKey]) return;

    if (sentCount > 0) waitBatchEmailInterval_();
    sendReminderEmail_({
      to: v.email,
      name: v.name || 'ゲスト',
      ceremonyAttendance: v.ceremony,
      receptionAttendance: v.reception,
      allergy: v.allergy || '',
      daysBefore: daysBefore,
      invitationUrl: getInvitationUrl_()
    });

    if (!isTest) {
      const now = new Date();
      sheet.getRange(record.rowNumber, sentColumn).setValue(now);
      sheet.getRange(record.rowNumber, COL.updatedAt).setValue(now);
    }
    sentCount++;
  });

  Logger.log(`${daysBefore}日前リマインド送信数: ${sentCount}`);
  return sentCount;
}

function sendAfterReceptionThanksEmails() {
  return sendAfterReceptionThanksEmails_(false);
}

function testAfterReceptionThanksEmails() {
  return sendAfterReceptionThanksEmails_(true);
}

/**
 * 指定ゲストの内容で、回答確認・1週間前・前日・参加御礼の確認用メールを送信します。
 * 実行しても各メールの送信日時は更新しません。
 */
function sendRequestedEmailPreviews() {
  return sendEmailPreviewsForGuest_('sfm549Eys', APP_CONFIG.previewRecipientEmail);
}

function sendEmailPreviewsForGuest_(guestIdRaw, recipientRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  const recipient = String(recipientRaw || '').trim();
  if (!guestId) throw new Error('guestIdがありません。');
  if (!isValidEmail_(recipient)) throw new Error('確認用メールアドレスを確認してください。');

  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const record = findGuestRecord_(sheet, guestId);
  if (!record) throw new Error('ゲスト情報が見つかりません。');
  const v = record.values;
  if (!isCompleted_(v)) throw new Error('指定ゲストの出欠回答が完了していません。');

  const reminderData = {
    to: recipient,
    name: v.name || 'ゲスト',
    ceremonyAttendance: v.ceremony,
    receptionAttendance: v.reception,
    allergy: v.allergy || '',
    invitationUrl: getInvitationUrl_()
  };
  sendConfirmationEmail_({
    to: recipient,
    name: v.name || 'ゲスト',
    ceremonyAttendance: v.ceremony,
    receptionAttendance: v.reception,
    allergy: v.allergy || '',
    message: v.message || '',
    invitationUrl: getInvitationUrl_()
  });
  waitBatchEmailInterval_();
  sendReminderEmail_(Object.assign({}, reminderData, { daysBefore: 7 }));
  waitBatchEmailInterval_();
  sendReminderEmail_(Object.assign({}, reminderData, { daysBefore: 1 }));
  waitBatchEmailInterval_();
  sendAfterReceptionThanksEmail_({
    to: recipient,
    name: v.name || 'ゲスト',
    invitationUrl: getInvitationUrl_()
  });

  Logger.log(`確認用メール送信数: 4 / guestId=${guestId} / to=${recipient}`);
  return 4;
}

/**
 * 指定ゲストの内容で、送金申告通知・着金確認・送金状況確認の
 * 3種類を確認用アドレスへ送信します。送信日時やステータスは更新しません。
 */
function sendGiftEmailPreviews() {
  return sendGiftEmailPreviewsForGuest_('sfm549Eys', APP_CONFIG.previewRecipientEmail);
}

function sendGiftEmailPreviewsForGuest_(guestIdRaw, recipientRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  const recipient = String(recipientRaw || '').trim();
  if (!guestId) throw new Error('guestIdがありません。');
  if (!isValidEmail_(recipient)) throw new Error('確認用メールアドレスを確認してください。');

  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const record = findGuestRecord_(sheet, guestId);
  if (!record) throw new Error('ゲスト情報が見つかりません。');
  const v = record.values;
  const previewData = {
    to: recipient,
    name: v.name || 'ゲスト',
    guestEmail: v.email || '',
    method: v.giftMethod || 'yucho',
    senderName: v.giftSenderName || v.name || '',
    declarationNote: v.giftDeclarationNote || '出席する家族3人分送金しました。',
    reportedAt: v.giftReportedAt || new Date(),
    invitationUrl: getInvitationUrl_(),
    spreadsheetUrl: getSpreadsheetUrl_(sheet)
  };
  sendGiftReportNotificationEmail_(previewData);
  waitBatchEmailInterval_();
  sendGiftConfirmationEmail_(previewData);
  waitBatchEmailInterval_();
  sendGiftIssueEmail_(previewData);

  Logger.log(`送金関連の確認用メール送信数: 3 / guestId=${guestId} / to=${recipient}`);
  return 3;
}

function handleGiftMailAction(e) {
  if (!e || !e.range || e.range.getRow() < 2 || e.range.getColumn() !== COL.giftAction) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== APP_CONFIG.sheetName) return;
  const action = String(e.value || '').trim();
  if (!Object.values(GIFT_ACTION).includes(action)) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertDedicatedExecutionAccount_();
    ensureHeaders_(sheet);
    const rowNumber = e.range.getRow();
    const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
    const values = rowToObject_(row);
    if (!values.id) throw new Error('ゲストIDがない行ではメールを送信できません。');
    if (!isValidEmail_(values.email)) throw new Error('ゲストのメールアドレスを確認してください。');

    const commonData = {
      to: values.email,
      name: values.name || 'ゲスト',
      method: values.giftMethod,
      senderName: values.giftSenderName,
      declarationNote: values.giftDeclarationNote,
      invitationUrl: getInvitationUrl_()
    };
    const now = new Date();

    if (action === GIFT_ACTION.confirm) {
      if (values.giftConfirmationSentAt) throw new Error('着金確認メールはすでに送信済みです。');
      if (![GIFT_STATUS.reported, GIFT_STATUS.issue].includes(values.giftStatus)) {
        throw new Error('ステータスが「確認待ち」または「要確認」のゲストを選択してください。');
      }
      sendGiftConfirmationEmail_(commonData);
      sheet.getRange(rowNumber, COL.giftStatus).setValue(GIFT_STATUS.confirmed);
      sheet.getRange(rowNumber, COL.giftConfirmedAt).setValue(now);
      sheet.getRange(rowNumber, COL.giftConfirmationSentAt).setValue(now);
      sheet.getRange(rowNumber, COL.giftAdminNote).setValue('着金確認メールを送信しました。');
      setGiftStatusCellStyle_(sheet, rowNumber, GIFT_STATUS.confirmed);
    } else {
      if (values.giftIssueSentAt) throw new Error('送金状況確認メールはすでに送信済みです。');
      if (values.giftStatus !== GIFT_STATUS.reported) {
        throw new Error('ステータスが「確認待ち」のゲストを選択してください。');
      }
      sendGiftIssueEmail_(commonData);
      sheet.getRange(rowNumber, COL.giftStatus).setValue(GIFT_STATUS.issue);
      sheet.getRange(rowNumber, COL.giftIssueSentAt).setValue(now);
      sheet.getRange(rowNumber, COL.giftAdminNote).setValue('送金状況確認メールを送信しました。送金先を再表示できます。');
      setGiftStatusCellStyle_(sheet, rowNumber, GIFT_STATUS.issue);
    }
    sheet.getRange(rowNumber, COL.updatedAt).setValue(now);
  } catch (error) {
    const rowNumber = e.range.getRow();
    sheet.getRange(rowNumber, COL.giftAdminNote).setValue(`メール操作エラー: ${error.message || error}`);
    console.error(error && error.stack ? error.stack : error);
  } finally {
    e.range.clearContent();
    lock.releaseLock();
  }
}

function sendPendingGiftReportNotifications() {
  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const records = readRecords_(sheet);
  let sentCount = 0;
  records.forEach(record => {
    const v = record.values;
    if (v.giftStatus !== GIFT_STATUS.reported || !v.giftReportedAt || v.giftHostNotifiedAt) return;
    if (sentCount > 0) waitBatchEmailInterval_();
    try {
      sendGiftReportNotificationEmail_({
        to: APP_CONFIG.giftNotificationEmail,
        name: v.name || 'ゲスト',
        guestEmail: v.email || '',
        method: v.giftMethod,
        senderName: v.giftSenderName,
        declarationNote: v.giftDeclarationNote,
        reportedAt: v.giftReportedAt,
        spreadsheetUrl: getSpreadsheetUrl_(sheet)
      });
      const now = new Date();
      sheet.getRange(record.rowNumber, COL.giftHostNotifiedAt).setValue(now);
      sheet.getRange(record.rowNumber, COL.giftAdminNote).setValue('未送信だった送金申告通知メールを自動送信しました。');
      sentCount++;
    } catch (error) {
      sheet.getRange(record.rowNumber, COL.giftAdminNote)
        .setValue(`送金申告通知メールの自動再送に失敗しました: ${error.message || error}`);
      console.error(error && error.stack ? error.stack : error);
    }
  });
  Logger.log(`送金申告通知メールの自動再送数: ${sentCount}`);
  return sentCount;
}

function sendAfterReceptionThanksEmails_(isTest) {
  const now = new Date();
  if (!isTest && now.getTime() < new Date(APP_CONFIG.receptionEndIso).getTime()) {
    Logger.log('Thanks mail skipped. Reception has not ended yet.');
    return 0;
  }

  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const records = readRecords_(sheet);
  let sentCount = 0;

  records.forEach(record => {
    const v = record.values;
    if (!isCompleted_(v)) return;
    if (!isValidEmail_(v.email)) return;
    if (!isAttending_(v.ceremony, v.reception)) return;
    if (!isTest && v.thanksSentAt) return;

    if (sentCount > 0) waitBatchEmailInterval_();
    sendAfterReceptionThanksEmail_({
      to: v.email,
      name: v.name || 'ゲスト',
      invitationUrl: getInvitationUrl_()
    });

    if (!isTest) {
      const sentAt = new Date();
      sheet.getRange(record.rowNumber, COL.thanksSentAt).setValue(sentAt);
      sheet.getRange(record.rowNumber, COL.updatedAt).setValue(sentAt);
    }
    sentCount++;
  });

  Logger.log(`参加ありがとうメール送信数: ${sentCount}`);
  return sentCount;
}

function sendConfirmationEmail_(data) {
  const subject = '【ご回答確認】Yusuke & Aika Wedding Invitation';
  const textBody = buildConfirmationText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.invitationUrl);
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody
  });
}

function sendReminderEmail_(data) {
  const subject = data.daysBefore === 7
    ? '【1週間前リマインド】Yusuke & Aika Wedding'
    : '【前日リマインド】Yusuke & Aika Wedding';
  const textBody = buildReminderText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.invitationUrl);
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody
  });
}

function sendAfterReceptionThanksEmail_(data) {
  const subject = '【御礼】本日はありがとうございました';
  const textBody = buildAfterReceptionThanksText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.invitationUrl);
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody
  });
}

function sendGiftReportNotificationEmail_(data) {
  const subject = `【送金申告】${data.name} 様から送金完了の連絡がありました`;
  const textBody = buildGiftReportNotificationText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.spreadsheetUrl, 'ゲスト一覧を開く');
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody,
    skipBcc: true
  });
}

function sendGiftReportCancellationNotificationEmail_(data) {
  const subject = `【送金申告取消】${data.name} 様が送金完了の連絡を取り消しました`;
  const textBody = buildGiftReportCancellationNotificationText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.spreadsheetUrl, 'ゲスト一覧を開く');
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody,
    skipBcc: true
  });
}

function sendGiftConfirmationEmail_(data) {
  const subject = '【ご送金確認】Yusuke & Aika Wedding';
  const textBody = buildGiftConfirmationText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.invitationUrl);
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody
  });
}

function sendGiftIssueEmail_(data) {
  const subject = '【ご送金状況のご確認】Yusuke & Aika Wedding';
  const textBody = buildGiftIssueText_(data);
  const htmlBody = buildHtmlMail_(subject, textBody, data.invitationUrl);
  sendWeddingEmail_({
    to: data.to,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody
  });
}

function sendWeddingEmail_(data) {
  assertDedicatedExecutionAccount_();
  const message = {
    to: data.to,
    subject: data.subject,
    name: APP_CONFIG.senderName,
    body: data.body,
    htmlBody: data.htmlBody
  };
  const bcc = String(APP_CONFIG.bccEmail || '').trim();
  if (!data.skipBcc && bcc && bcc.toLowerCase() !== String(data.to || '').trim().toLowerCase()) {
    message.bcc = bcc;
  }
  MailApp.sendEmail(message);
}

function waitBatchEmailInterval_() {
  Utilities.sleep(APP_CONFIG.batchEmailIntervalMs);
}

function assertDedicatedExecutionAccount_() {
  const expectedEmail = String(APP_CONFIG.senderEmail || '').trim().toLowerCase();
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (effectiveEmail !== expectedEmail) {
    const actual = effectiveEmail || '取得できませんでした';
    throw new Error(`GASの実行アカウントが正しくありません。期待値: ${expectedEmail} / 実行中: ${actual}`);
  }
}

function buildConfirmationText_(data) {
  const messageParagraph = data.message ? `\n\n【メッセージ】\n${data.message}` : '';
  return `${data.name} 様\n\n結婚式へのご出欠について、\nご回答いただき誠にありがとうございます。\n以下の内容で承りました。\n\n【挙式】${data.ceremonyAttendance}\n【披露宴】${data.receptionAttendance}\n【アレルギー】${data.allergy || 'なし'}${messageParagraph}\n\n【日時】${APP_CONFIG.weddingDateLabel}\n挙式 ${APP_CONFIG.ceremonyTimeLabel}\n披露宴 ${APP_CONFIG.receptionTimeLabel}\n\n【会場】${APP_CONFIG.venueName}\n${APP_CONFIG.venueUrl}\n\nGoogle Map：${APP_CONFIG.mapUrl}\n\n招待状URL：\n${data.invitationUrl}\n\n当日お会いできますことを、\n心より楽しみにしております。\n\nYusuke & Aika`;
}

function buildReminderText_(data) {
  const timing = data.daysBefore === 7 ? '1週間前' : '前日';
  const meetingDay = data.daysBefore === 1 ? '明日' : '当日';
  return `${data.name} 様\n\n結婚式${timing}のリマインドです。\n当日はお気をつけてお越しください。\n\n【日時】${APP_CONFIG.weddingDateLabel}\n挙式 ${APP_CONFIG.ceremonyTimeLabel}\n披露宴 ${APP_CONFIG.receptionTimeLabel}\n\n【会場】${APP_CONFIG.venueName}\n${APP_CONFIG.venueUrl}\n\nGoogle Map：${APP_CONFIG.mapUrl}\n\n【ご回答内容】\n挙式：${data.ceremonyAttendance}\n披露宴：${data.receptionAttendance}\nアレルギー：${data.allergy || 'なし'}\n\n招待状URL：\n${data.invitationUrl}\n\n皆様と${meetingDay}お会いできますことを、\n心より楽しみにしております。\n\nYusuke & Aika`;
}

function buildAfterReceptionThanksText_(data) {
  return `${data.name} 様\n\n本日は私たちの結婚式にご参加いただき、\n誠にありがとうございました。\n皆様と大切な時間を過ごすことができ、\n心より感謝しております。\n\n招待状URL：\n${data.invitationUrl}\n\n今後ともどうぞよろしくお願いいたします。\n\nYusuke & Aika`;
}

function buildGiftReportNotificationText_(data) {
  const senderLine = data.senderName || 'ゲスト名と同じ、または未入力';
  const noteLine = data.declarationNote || 'なし';
  return `送金完了のご連絡がありました。\n口座・PayPayの着金をご確認ください。\n\n【ゲスト名】${data.name}\n【ゲストのメールアドレス】${data.guestEmail || '未登録'}\n【送金方法】${getGiftMethodLabel_(data.method)}\n【送金元名義】${senderLine}\n【送金についてのメモ】${noteLine}\n【申告日時】${formatDateTime_(data.reportedAt)}\n\n現在のステータスは「確認待ち」です。\n着金を確認できた場合は、ゲスト一覧の「メール操作」で\n「${GIFT_ACTION.confirm}」を選択してください。\n確認できない場合は「${GIFT_ACTION.issue}」を選択してください。\n\nYusuke & Aika Wedding Invitation`;
}

function buildGiftReportCancellationNotificationText_(data) {
  return `${data.name} 様が、送金完了のご連絡を取り消しました。\n\n【ゲスト名】${data.name}\n【ゲストのメールアドレス】${data.guestEmail || '未登録'}\n【取消日時】${formatDateTime_(data.cancelledAt)}\n${data.previousSummary ? `【取消前の内容】${data.previousSummary}\n` : ''}\nステータスは「未送金」に戻り、ゲストは送金先を再度表示できます。\n\nYusuke & Aika Wedding Invitation`;
}

function buildGiftConfirmationText_(data) {
  const details = buildGiftDeclarationDetailsText_(data);
  return `${data.name} 様\n\nご送金を確認いたしました。\nお心遣いをいただき、誠にありがとうございます。${details}\n\n万一、お心当たりの内容と異なる場合は、\nこのメールへご返信ください。\n\n招待状URL：\n${data.invitationUrl}\n\n当日お会いできますことを、\n心より楽しみにしております。\n\nYusuke & Aika`;
}

function buildGiftIssueText_(data) {
  const details = buildGiftDeclarationDetailsText_(data);
  return `${data.name} 様\n\n招待状から送金完了のご連絡をいただきましたが、\n現時点では該当する入金を確認できておりません。\n行き違いでしたら申し訳ございません。${details}\n\nお手数ですが、送金アプリの履歴が「完了」に\nなっているか、送金先名義に誤りがないかを\nご確認いただけますでしょうか。\n\n送金が完了していなかった場合は、\n招待状から送金先を再度表示していただけます。\n銀行振込・PayPay・当日現金もお選びいただけます。\n\n招待状URL：\n${data.invitationUrl}\n\nご不明な点がございましたら、\nこのメールへご返信ください。\n\nYusuke & Aika`;
}

function buildGiftDeclarationDetailsText_(data) {
  const lines = [];
  if (data.method) lines.push(`【送金方法】${getGiftMethodLabel_(data.method)}`);
  if (data.senderName) lines.push(`【送金元名義】${data.senderName}`);
  if (data.declarationNote) lines.push(`【送金についてのメモ】${data.declarationNote}`);
  return lines.length ? `\n\n${lines.join('\n')}` : '';
}

function buildHtmlMail_(title, textBody, invitationUrl, linkLabel) {
  const titleHtml = buildHtmlMailTitle_(title);
  const bodyHtml = buildHtmlMailParagraphs_(textBody);
  const safeLinkLabel = escapeHtml_(linkLabel || '招待状を開く');
  return `
    <div style="margin:0;padding:12px 8px;background:#fff8f3;color:#392724;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:16px;line-height:1.75;-webkit-text-size-adjust:100%;">
      <div style="max-width:600px;margin:0 auto;padding:24px 18px;border:1px solid #e3c7af;border-radius:20px;background:#fffdfb;">
        <h1 style="margin:0 0 20px;color:#7a1d33;font-size:20px;line-height:1.5;font-weight:700;word-break:keep-all;">${titleHtml}</h1>
        <div style="margin:0;overflow-wrap:anywhere;word-break:break-word;">${bodyHtml}</div>
        <p style="margin:24px 0 0;"><a href="${escapeHtml_(invitationUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#7a1d33;color:#fff;font-size:16px;font-weight:700;line-height:1.5;text-decoration:none;">${safeLinkLabel}</a></p>
      </div>
    </div>`;
}

function buildHtmlMailTitle_(title) {
  const match = String(title || '').match(/^(【[^】]+】)\s*(.*)$/);
  if (!match || !match[2]) return escapeHtml_(title);
  return `${escapeHtml_(match[1])}<span style="display:block;">${escapeHtml_(match[2])}</span>`;
}

function buildHtmlMailParagraphs_(textBody) {
  return String(textBody || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .filter(paragraph => paragraph !== '')
    .map((paragraph, index) => {
      const margin = index === 0 ? '0' : '18px 0 0';
      const lines = escapeHtml_(paragraph).replace(/\n/g, '<br>');
      return `<p style="margin:${margin};">${lines}</p>`;
    })
    .join('');
}

function resetTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const handler = trigger.getHandlerFunction();
    if ([
      'sendReminderEmails',
      'sendAfterReceptionThanksEmails',
      'sendPendingGiftReportNotifications',
      'handleGiftMailAction'
    ].includes(handler)) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('sendReminderEmails')
    .timeBased()
    .everyDays(1)
    .atHour(APP_CONFIG.reminderHour)
    .create();
  ScriptApp.newTrigger('sendAfterReceptionThanksEmails')
    .timeBased()
    .everyDays(1)
    .atHour(APP_CONFIG.thanksHour)
    .create();
  ScriptApp.newTrigger('sendPendingGiftReportNotifications')
    .timeBased()
    .everyHours(1)
    .create();
  ScriptApp.newTrigger('handleGiftMailAction')
    .forSpreadsheet(APP_CONFIG.spreadsheetId)
    .onEdit()
    .create();
}

function getMainSheet_() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  return APP_CONFIG.sheetName ? ss.getSheetByName(APP_CONFIG.sheetName) : ss.getSheets()[0];
}

function ensureHeaders_(sheet) {
  const legacyInvitationUrlColumn = 12;
  const legacyHeader = String(sheet.getRange(1, legacyInvitationUrlColumn).getValue() || '').trim();
  if (legacyHeader === '招待状URL') {
    throw new Error('スプレッドシートが旧形式です。GASエディタからsetupを実行してください。');
  }
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsUpdate = HEADERS.some((header, index) => String(current[index] || '') !== header);
  if (needsUpdate) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function removeLegacyInvitationUrlColumn_(sheet) {
  const legacyInvitationUrlColumn = 12;
  const header = String(sheet.getRange(1, legacyInvitationUrlColumn).getValue() || '').trim();
  if (header === '招待状URL') sheet.deleteColumn(legacyInvitationUrlColumn);
}

function ensureGiftStatusColumn_(sheet) {
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      GIFT_STATUS.unsent,
      GIFT_STATUS.reported,
      GIFT_STATUS.confirmed,
      GIFT_STATUS.issue,
      GIFT_STATUS.cash
    ], true)
    .setAllowInvalid(false)
    .build();
  const availableRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL.giftStatus, availableRows, 1).setDataValidation(validation);

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rowCount = lastRow - 1;
    const ids = sheet.getRange(2, COL.id, rowCount, 1).getValues();
    const statuses = sheet.getRange(2, COL.giftStatus, rowCount, 1).getValues();
    let changed = false;
    statuses.forEach((row, index) => {
      if (!String(ids[index][0] || '').trim()) return;
      const normalized = normalizeGiftStatus_(row[0]);
      if (String(row[0] || '').trim() !== normalized) {
        row[0] = normalized;
        changed = true;
      }
    });
    if (changed) sheet.getRange(2, COL.giftStatus, rowCount, 1).setValues(statuses);
    applyGiftStatusStyles_(sheet, statuses);
  }
}

function ensureGiftActionColumn_(sheet) {
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList([GIFT_ACTION.confirm, GIFT_ACTION.issue], true)
    .setAllowInvalid(false)
    .setHelpText('メールを送信する場合だけ操作を選択してください。送信後は自動で空欄に戻ります。')
    .build();
  const availableRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL.giftAction, availableRows, 1).setDataValidation(validation);
}

function formatSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f8e9df');
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.setColumnWidth(COL.giftStatus, 120);
  sheet.setColumnWidth(COL.giftMethod, 185);
  sheet.setColumnWidth(COL.giftSenderName, 150);
  sheet.setColumnWidth(COL.giftDeclarationNote, 260);
  sheet.setColumnWidth(COL.giftAction, 230);
  sheet.setColumnWidth(COL.giftAdminNote, 340);
  sheet.getRange(2, COL.giftDeclarationNote, Math.max(sheet.getMaxRows() - 1, 1), 1).setWrap(true);
  sheet.getRange(2, COL.giftAdminNote, Math.max(sheet.getMaxRows() - 1, 1), 1).setWrap(true);
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), HEADERS.length).setVerticalAlignment('middle');
}

function readRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows.map((row, index) => ({ rowNumber: index + 2, values: rowToObject_(row) })).filter(record => record.values.id);
}

function findGuestRecord_(sheet, guestId) {
  const target = normalizeGuestId_(guestId);
  return readRecords_(sheet).find(record => normalizeGuestId_(record.values.id) === target) || null;
}

function rowToObject_(row) {
  return {
    id: String(row[COL.id - 1] || '').trim(),
    name: String(row[COL.name - 1] || '').trim(),
    email: String(row[COL.email - 1] || '').trim(),
    ceremony: String(row[COL.ceremony - 1] || '').trim(),
    reception: String(row[COL.reception - 1] || '').trim(),
    allergy: String(row[COL.allergy - 1] || '').trim(),
    submittedAt: row[COL.submittedAt - 1],
    confirmationSentAt: row[COL.confirmationSentAt - 1],
    reminder7SentAt: row[COL.reminder7SentAt - 1],
    reminder1SentAt: row[COL.reminder1SentAt - 1],
    updatedAt: row[COL.updatedAt - 1],
    message: String(row[COL.message - 1] || '').trim(),
    thanksSentAt: row[COL.thanksSentAt - 1],
    giftStatus: normalizeGiftStatus_(row[COL.giftStatus - 1]),
    giftMethod: String(row[COL.giftMethod - 1] || '').trim(),
    giftSenderName: String(row[COL.giftSenderName - 1] || '').trim(),
    giftDeclarationNote: String(row[COL.giftDeclarationNote - 1] || '').trim(),
    giftReportedAt: row[COL.giftReportedAt - 1],
    giftHostNotifiedAt: row[COL.giftHostNotifiedAt - 1],
    giftConfirmedAt: row[COL.giftConfirmedAt - 1],
    giftConfirmationSentAt: row[COL.giftConfirmationSentAt - 1],
    giftIssueSentAt: row[COL.giftIssueSentAt - 1],
    giftAction: String(row[COL.giftAction - 1] || '').trim(),
    giftAdminNote: String(row[COL.giftAdminNote - 1] || '').trim()
  };
}

function isCompleted_(values) {
  return Boolean(normalizeAttendance_(values.ceremony) && normalizeAttendance_(values.reception));
}

function isAttending_(ceremony, reception) {
  return normalizeAttendance_(ceremony) === '出席' || normalizeAttendance_(reception) === '出席';
}

function normalizeGiftStatus_(value) {
  const status = String(value || '').trim();
  const normalized = LEGACY_GIFT_STATUS[status] || status;
  if ([
    GIFT_STATUS.unsent,
    GIFT_STATUS.reported,
    GIFT_STATUS.confirmed,
    GIFT_STATUS.issue,
    GIFT_STATUS.cash
  ].includes(normalized)) {
    return normalized;
  }
  return GIFT_STATUS.unsent;
}

function isGiftLocked_(value) {
  const status = normalizeGiftStatus_(value);
  return !canShowGiftInformation_(status);
}

function canShowGiftInformation_(value) {
  const status = normalizeGiftStatus_(value);
  return status === GIFT_STATUS.unsent || status === GIFT_STATUS.issue;
}

function applyGiftStatusStyles_(sheet, statuses) {
  if (!statuses.length) return;
  const backgrounds = statuses.map(row => [getGiftStatusStyle_(row[0]).background]);
  const colors = statuses.map(row => [getGiftStatusStyle_(row[0]).color]);
  const range = sheet.getRange(2, COL.giftStatus, statuses.length, 1);
  range.setBackgrounds(backgrounds).setFontColors(colors).setFontWeight('bold');
}

function setGiftStatusCellStyle_(sheet, rowNumber, status) {
  const style = getGiftStatusStyle_(status);
  sheet.getRange(rowNumber, COL.giftStatus)
    .setBackground(style.background)
    .setFontColor(style.color)
    .setFontWeight('bold');
}

function getGiftStatusStyle_(statusRaw) {
  const status = normalizeGiftStatus_(statusRaw);
  if (status === GIFT_STATUS.reported) return { background: '#fff1c7', color: '#7a5410' };
  if (status === GIFT_STATUS.confirmed) return { background: '#e3f2df', color: '#37613c' };
  if (status === GIFT_STATUS.issue) return { background: '#fbe2df', color: '#913838' };
  if (status === GIFT_STATUS.cash) return { background: '#eee8e4', color: '#5f514d' };
  return { background: '#ffffff', color: '#665956' };
}

function normalizeAttendance_(value) {
  const v = String(value || '').trim();
  if (['出席', '参加', 'attend', 'yes', '参加する'].includes(v)) return '出席';
  if (['欠席', '不参加', 'decline', 'no', '参加しない'].includes(v)) return '欠席';
  return '';
}

function normalizeGuestId_(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function getInvitationUrl_() {
  return APP_CONFIG.baseInvitationUrl.replace(/\/?$/, '/');
}

function getSpreadsheetUrl_(sheet) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(APP_CONFIG.spreadsheetId)}/edit#gid=${sheet.getSheetId()}`;
}

function getGiftMethodLabel_(methodRaw) {
  const method = String(methodRaw || '').trim().toLowerCase();
  return GIFT_METHOD_LABELS[method] || method || '未記録';
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function formatDateTime_(date) {
  return Utilities.formatDate(new Date(date), APP_CONFIG.timeZone, 'yyyy/MM/dd HH:mm:ss');
}

function daysBeforeWedding_(date) {
  const today = dateOnly_(date);
  const wedding = dateOnly_(new Date(APP_CONFIG.weddingDateIso));
  return Math.round((wedding.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function dateOnly_(date) {
  const y = Utilities.formatDate(new Date(date), APP_CONFIG.timeZone, 'yyyy');
  const m = Utilities.formatDate(new Date(date), APP_CONFIG.timeZone, 'MM');
  const d = Utilities.formatDate(new Date(date), APP_CONFIG.timeZone, 'dd');
  return new Date(`${y}-${m}-${d}T00:00:00+09:00`);
}

function parsePostParams_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    const type = e.postData.type || '';
    if (type.includes('application/json')) return JSON.parse(e.postData.contents);
  }
  return (e.parameter || {});
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    const safeCallback = String(callback).replace(/[^\w.$]/g, '');
    return ContentService.createTextOutput(`${safeCallback}(${json});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
