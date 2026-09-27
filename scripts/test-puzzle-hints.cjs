const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
let now = Date.parse('2027-03-21T06:00:00Z');
class Clock extends Date { constructor(value) { super(arguments.length ? value : now); } static now() { return now; } }
const sheets = new Map();
function sheet() {
  const rows = [];
  return { rows, getLastRow: () => rows.length, appendRow: row => rows.push(row.slice()), setFrozenRows() {}, getRange(r, c, n) { return { getValues: () => rows.slice(r-1, r-1+n).map(row=>row.slice()), setValue(v) { rows[r-1][c-1]=v; return this; }, setNumberFormat() {return this;} }; } };
}
const visits=sheet(); visits.appendRow([]); sheets.set('来場感謝サイト訪問記録', visits);
const book = {getSheetByName:n=>sheets.get(n), insertSheet:n=>{const s=sheet();sheets.set(n,s);return s;}};
const c = vm.createContext({Date:Clock, Map, APP_CONFIG:{spreadsheetId:'test'}, SpreadsheetApp:{openById:()=>book,flush(){}}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
vm.runInContext(fs.readFileSync('gas/LastPuzzle.gs','utf8'),c);
c.normalizeGuestId_=v=>String(v||''); c.getMainSheet_=()=>({});
c.findGuestRecord_=(_,id)=>id==='Case_ID'?{values:{id,name:'Test'}}:null;
c.getWeddingSchedule_=()=>({end:new Clock('2027-03-21T05:00:00Z')});
const call=(hint,guestId='Case_ID')=>c.puzzleHints_({guestId,hint});
assert.throws(()=>call(1,'case_id'));
const first=call(); assert.equal(first.opened.length,0); assert.equal(first.hints.length,0);
for(let n=1;n<=5;n++) {
 now=Date.parse(first.firstSeen)+n*300000-1;
 assert.throws(()=>call(n));
 now++;
 const result=call(n); assert.equal(result.opened.length,n); assert.equal(result.hints.length,n);
 assert.equal(call(n).opened.length,n); assert.equal(call().firstSeen,first.firstSeen);
}
assert.equal(sheets.get('謎解きヒント記録').rows.length,2);
let result=c.recordThanksVisit_({guestId:'Case_ID',keyword:'thanks',eventId:'fixture-hints-00001'});
assert.equal(result.hintCount,5);
sheets.get('謎解きヒント記録').rows[1][2]='1';
result=c.recordThanksVisit_({guestId:'Case_ID',keyword:'thanks',eventId:'fixture-hints-00002'});
assert.equal(result.hintCount,5); assert.equal(result.rank,1);
assert.equal(c.getThanksVisitState_('Case_ID',new Clock('2027-03-21T05:00:00Z'),new Clock()).hintCount,5);
c.getWeddingSchedule_=()=>({end:new Clock('2099-01-01T00:00:00Z')}); assert.throws(()=>call());
const ui=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('js/puzzle-hints.js','utf8'),ui);
assert.deepEqual([1,2,3,4,11,12,13,21,22,23,111].map(ui.window.WeddingHints.ordinal),['1st','2nd','3rd','4th','11th','12th','13th','21st','22nd','23rd','111th']);
for(let n=0;n<=5;n++)assert.equal(ui.window.WeddingHints.clearLabel(n),n?`${n}-Hint Clear!`:'No-Hint Clear!');
console.log('PASS five unlock boundaries, server clock, case sensitivity, reopen/reload persistence, first-clear snapshot, release gate and English labels');
