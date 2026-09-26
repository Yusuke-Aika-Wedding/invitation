const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
let quota = 2, identity = 'yusuke.aika.wedding@gmail.com', writes = 0, sends = 0;
const c = vm.createContext({
  Session: { getEffectiveUser: () => ({ getEmail: () => identity }) },
  MailApp: { getRemainingDailyQuota: () => quota, sendEmail: () => { sends++; } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../gas/Code.gs'), 'utf8'), c);
c.getMainSheet_ = () => ({ getRange: () => ({ setValues() { writes++; }, setValue() { writes++; } }) });
c.ensureHeaders_ = () => {};
c.findGuestRecord_ = () => ({ rowNumber: 2, values: { id: 'fixture' } });
c.buildHtmlMail_ = () => '<p>Test</p>';
const params = { guestId: 'fixture', name: 'Test', email: 'guest@example.com', ceremonyAttendance: '出席', receptionAttendance: '欠席', allergyChoice: 'なし' };
identity = 'wrong@example.com';
assert.throws(() => c.submitResponse_(params), /実行アカウント/);
assert.equal(writes, 0);
identity = 'yusuke.aika.wedding@gmail.com'; quota = 1;
assert.throws(() => c.submitResponse_(params), /送信上限/);
assert.equal(writes, 0);
assert.doesNotThrow(() => c.assertConfirmationEmailReady_(identity));
quota = 2;
assert.equal(c.submitResponse_(params).ok, true);
assert.equal(sends, 1);
assert.equal(writes, 3);
console.log('PASS wrong sender and insufficient quota do not save; valid submission sends once and records completion');
