const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..')+'/';
const c=vm.createContext({window:{},Date,APP_CONFIG:{spreadsheetId:'test'}});
vm.runInContext(fs.readFileSync(root+'gas/DearGuest.gs','utf8'),c);
vm.runInContext(fs.readFileSync(root+'js/dear-guest.js','utf8'),c);
const start=new Date('2027-03-21T10:00:00+09:00'),end=new Date('2027-03-21T14:00:00+09:00');
for(const [time,phase] of [['2027-03-19T23:59:59+09:00','early'],['2027-03-20T00:00:00+09:00','eve'],['2027-03-20T23:59:59+09:00','eve'],['2027-03-21T00:00:00+09:00','today'],['2027-03-21T09:59:59+09:00','today'],['2027-03-21T10:00:00+09:00','during'],['2027-03-21T13:59:59+09:00','during'],['2027-03-21T14:00:00+09:00','after'],['2027-03-22T00:00:00+09:00','after']])assert.equal(c.dearGuestPhase_(new Date(time),start,end),phase);
assert.equal(c.dearGuestPhase_(new Date(),null,end),'early');assert.equal(c.dearGuestPhase_(new Date(),end,start),'early');
let count=0;const select=c.window.WeddingDearGuest.selectMessage;
for(const completed of [false,true])for(const attending of [false,true])for(const text of ['', '個別メッセージ\n改行'])for(const phase of ['early','eve','today','during','after'])for(const thanksVisited of [false,true]){
 const status={completed,attending,invitationMessage:text,dearGuest:{thanksVisited}},r=select(status,phase),out=JSON.stringify(r);
 assert.equal(r.custom,!!(completed&&attending&&phase==='early'&&text));
 if(!completed)assert.match(out,/ご入力・ご回答/);else if(!attending)assert.match(out,/またお会いできる日/);else if(phase==='after')assert.match(out,thanksVisited?/さすがです/:/隠されているよう/);
 count++;
}
// Case-sensitive persisted visits; unknown visits never count for a guest.
c.puzzleReleaseDate_=v=>v instanceof Date?v:null;
c.SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='公開設定'?{getRange:()=>({getValues:()=>[[start],[end]]})}:{getLastRow:()=>3,getRange:()=>({getValues:()=>[['Case_ID'],['ID不明']]})}})};
c.PUZZLE_SETTINGS_SHEET='公開設定';c.THANKS_VISITS_SHEET='来場感謝サイト訪問記録';
assert.equal(c.getDearGuestState_('Case_ID',end).thanksVisited,true);assert.equal(c.getDearGuestState_('case_id',end).thanksVisited,false);
console.log(`PASS ${count} message combinations, JST calendar boundaries, invalid settings, persisted case-sensitive visits`);
