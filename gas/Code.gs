/**
 * Yusuke & Aika Wedding Invitation Backend
 *
 * GitHub PagesからJSONPで呼び出すGoogle Apps Scriptです。
 * スプレッドシート列：
 * A ID / B ゲスト名 / C メールアドレス / D 挙式出欠 / E 披露宴出欠 / F アレルギー
 * G 回答日時 / H 確認メール送信日時 / I 1週間前リマインド送信日時
 * J 前日リマインド送信日時 / K 更新日時 / L メッセージ
 * M 参加ありがとうメール送信日時 / N ご祝儀
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
  'ご祝儀'
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
  giftStatus: 14
};

const GIFT_STATUS = {
  unpaid: '未入金',
  paid: '入金済み',
  repaid: '再入金'
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
    if (action === 'confirmGiftSent') return output_(confirmGiftSent_(params.guestId), params.callback);
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
  return {
    ok: true,
    guestId: values.id,
    displayName: values.name || 'ゲスト',
    completed: completed,
    attending: isAttending_(values.ceremony, values.reception),
    giftSent: isGiftSettled_(values.giftStatus),
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
      normalizeGiftStatus_(record.values.giftStatus)
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

    return {
      ok: true,
      completed: true,
      attending: isAttending_(ceremonyAttendance, receptionAttendance),
      giftSent: isGiftSettled_(record.values.giftStatus),
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
  if (!['yucho', 'rakuten', 'paypay'].includes(method)) throw new Error('送金方法を確認してください。');

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

function confirmGiftSent_(guestIdRaw) {
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

    if (!isGiftSettled_(record.values.giftStatus)) {
      const now = new Date();
      sheet.getRange(record.rowNumber, COL.giftStatus).setValue(GIFT_STATUS.paid);
      sheet.getRange(record.rowNumber, COL.updatedAt).setValue(now);
      SpreadsheetApp.flush();
    }

    // 入金確認メールは今後実装します。現時点ではステータス更新だけを行います。
    return { ok: true, giftSent: true };
  } finally {
    lock.releaseLock();
  }
}

function assertGiftInformationAvailable_(values) {
  if (!isCompleted_(values) || !isAttending_(values.ceremony, values.reception)) {
    throw new Error('送金情報の確認対象ではありません。');
  }
  if (isGiftSettled_(values.giftStatus)) {
    throw new Error('送金済みのため、送金先情報は表示できません。');
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

function sendWeddingEmail_(data) {
  assertDedicatedExecutionAccount_();
  MailApp.sendEmail({
    to: data.to,
    bcc: APP_CONFIG.bccEmail,
    subject: data.subject,
    name: APP_CONFIG.senderName,
    body: data.body,
    htmlBody: data.htmlBody
  });
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

function buildHtmlMail_(title, textBody, invitationUrl) {
  const titleHtml = buildHtmlMailTitle_(title);
  const bodyHtml = buildHtmlMailParagraphs_(textBody);
  return `
    <div style="margin:0;padding:12px 8px;background:#fff8f3;color:#392724;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:16px;line-height:1.75;-webkit-text-size-adjust:100%;">
      <div style="max-width:600px;margin:0 auto;padding:24px 18px;border:1px solid #e3c7af;border-radius:20px;background:#fffdfb;">
        <h1 style="margin:0 0 20px;color:#7a1d33;font-size:20px;line-height:1.5;font-weight:700;word-break:keep-all;">${titleHtml}</h1>
        <div style="margin:0;overflow-wrap:anywhere;word-break:break-word;">${bodyHtml}</div>
        <p style="margin:24px 0 0;"><a href="${escapeHtml_(invitationUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#7a1d33;color:#fff;font-size:16px;font-weight:700;line-height:1.5;text-decoration:none;">招待状を開く</a></p>
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
    if (handler === 'sendReminderEmails' || handler === 'sendAfterReceptionThanksEmails') {
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
    .requireValueInList([GIFT_STATUS.paid, GIFT_STATUS.repaid, GIFT_STATUS.unpaid], true)
    .setAllowInvalid(false)
    .build();
  const availableRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL.giftStatus, availableRows, 1).setDataValidation(validation);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const rowCount = lastRow - 1;
  const ids = sheet.getRange(2, COL.id, rowCount, 1).getValues();
  const statuses = sheet.getRange(2, COL.giftStatus, rowCount, 1).getValues();
  let changed = false;
  statuses.forEach((row, index) => {
    if (String(ids[index][0] || '').trim() && !String(row[0] || '').trim()) {
      row[0] = GIFT_STATUS.unpaid;
      changed = true;
    }
  });
  if (changed) sheet.getRange(2, COL.giftStatus, rowCount, 1).setValues(statuses);
}

function formatSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f8e9df');
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.setColumnWidth(COL.giftStatus, 110);
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
    giftStatus: normalizeGiftStatus_(row[COL.giftStatus - 1])
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
  if ([GIFT_STATUS.paid, GIFT_STATUS.repaid, GIFT_STATUS.unpaid].includes(status)) return status;
  return GIFT_STATUS.unpaid;
}

function isGiftSettled_(value) {
  const status = normalizeGiftStatus_(value);
  return status === GIFT_STATUS.paid || status === GIFT_STATUS.repaid;
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
