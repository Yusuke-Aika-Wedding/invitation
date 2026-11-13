const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..')+'/';
const c=vm.createContext({window:{},Date,APP_CONFIG:{spreadsheetId:'test'}});
vm.runInContext(fs.readFileSync(root+'gas/LastPuzzle.gs','utf8'),c);
vm.runInContext(fs.readFileSync(root+'gas/DearGuest.gs','utf8'),c);
vm.runInContext(fs.readFileSync(root+'js/dear-guest.js','utf8'),c);
const start=new Date('2027-03-21T10:00:00+09:00'),end=new Date('2027-03-21T14:00:00+09:00');
for(const [time,phase] of [['2027-03-19T23:59:59+09:00','early'],['2027-03-20T00:00:00+09:00','eve'],['2027-03-20T23:59:59+09:00','eve'],['2027-03-21T00:00:00+09:00','today'],['2027-03-21T09:59:59+09:00','today'],['2027-03-21T10:00:00+09:00','during'],['2027-03-21T13:59:59+09:00','during'],['2027-03-21T14:00:00+09:00','after'],['2027-03-22T00:00:00+09:00','after']])assert.equal(c.dearGuestPhase_(new Date(time),start,end),phase);
assert.equal(c.dearGuestPhase_(new Date(),null,end),'early');assert.equal(c.dearGuestPhase_(new Date(),end,start),'early');
let count=0;const select=c.window.WeddingDearGuest.selectMessage;
for(const completed of [false,true])for(const attending of [false,true])for(const text of ['', '個別メッセージ\n改行'])for(const phase of ['early','eve','today','during','after'])for(const thanksVisited of [false,true]){
 const status={completed,attending,invitationMessage:text,dearGuest:{thanksVisited}},r=select(status,phase),out=JSON.stringify(r);
 assert.equal(r.custom,!!(completed&&attending&&phase==='early'&&text));
 if(!completed)assert.match(out,/ぜひご出席いただきたく ご案内申し上げます/);else if(!attending)assert.match(out,/またお会いできる日/);else if(phase==='after')assert.match(out,thanksVisited?/さすがです/:/隠されているよう/);
 count++;
}
// Case-sensitive persisted visits; unknown visits never count for a guest.
c.puzzleReleaseDate_=v=>v instanceof Date?v:null;
c.SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='公開設定'?{getLastRow:()=>3,getRange:()=>({getValues:()=>[['Dear Guest 結婚式開始日時',start],['Dear Guest 結婚式終了日時',end]]})}:{getLastRow:()=>3,getRange:()=>({getValues:()=>[[end,'Case_ID','Fixture','joy','confirmed','fixture-event-01'],[end,'ID不明','Unknown','joy','unknown','fixture-event-02']]})}})};
c.PUZZLE_SETTINGS_SHEET='公開設定';c.THANKS_VISITS_SHEET='来場感謝サイト訪問記録';
assert.equal(c.getDearGuestState_('Case_ID',end).thanksVisited,true);assert.equal(c.getDearGuestState_('case_id',end).thanksVisited,false);
console.log(`PASS ${count} message combinations, JST calendar boundaries, invalid settings, persisted case-sensitive visits`);
const expectedRsvp = {
 early: '当日お会いできますことを 心より楽しみにしております',
 eve: '明日お会いできますことを 心より楽しみにしております',
 today: '本日お会いできますことを 心より楽しみにしております',
 during: 'ついに始まりましたね！楽しみましょう！',
 after: 'ご来場ありがとうございました！\n楽しんでいただけましたか？'
};
for (const [phase, text] of Object.entries(expectedRsvp)) {
 for (const completed of [false, true]) for (const attending of [false, true]) {
  const result = c.window.WeddingDearGuest.selectRsvp({ completed, attending }, phase);
  assert.equal(result.hidden, !completed && ['during', 'after'].includes(phase));
  assert.equal(result.text, attending ? text : 'またお会いできる日を楽しみにしております');
 }
}
console.log('PASS RSVP exact copy and visibility across 20 response/phase combinations');

for (const [early, after] of [[false,false],[true,false],[true,true],[false,true]]) {
 const result=select({completed:true,attending:true,dearGuest:{thanksVisited:after,thanksVisitedBefore:early}},'after');
 const copy=JSON.stringify(result);
 assert.equal(copy.includes('あのときのIDをもう一度入力してください！'), early&&!after);
 assert.equal(copy.includes('さすがです'),after);
}
console.log('PASS early-only guests receive the exact revisit reminder; post-release visitors receive solved copy');

for(const [phase,expected] of Object.entries({early:'当日はお気をつけてお越しください',eve:'明日はお気をつけてお越しください',today:'本日はお気をつけてお越しください',during:'本日はお気をつけてお越しください',after:'ご来場ありがとうございました'}))assert.equal(c.window.WeddingDearGuest.selectArrival(phase).join(''),expected);
console.log('PASS Access copy in all five wedding phases');

const afterStatus={completed:true,attending:true,dearGuest:{thanksVisited:false,solvedCount:0}};
assert.match(JSON.stringify(select(afterStatus,'after')),/隠されているよう/);
assert.match(JSON.stringify(select({...afterStatus,puzzleViewed:true},'after')),/現在 まだ誰も最後の謎を解き明かしていません！/);
assert.match(JSON.stringify(select({...afterStatus,puzzleViewed:true,dearGuest:{solvedCount:12}},'after')),/現在 12人が最後の謎を解き明かしました！/);
const visited={...afterStatus,dearGuest:{thanksVisited:true,solvedCount:12}};
assert.equal(JSON.stringify(select({...visited,puzzleViewed:true},'after')),JSON.stringify(select(visited,'after')));
assert.match(JSON.stringify(select({...afterStatus,puzzleViewed:true,dearGuest:{}},'after')),/隠されているよう/);
const visitRows=[[end,'One','','','','event1'],[end,'One','','','','event2'],[end,'one','','','','event3'],[end,'ID不明','','','','event4'],[new Date(end.getTime()+1),'Future','','','','event5']];
c.SpreadsheetApp={openById:()=>({getSheetByName:()=>({getLastRow:()=>visitRows.length+1,getRange:()=>({getValues:()=>visitRows})})})};
assert.equal(c.getThanksVisitState_('viewer',end,end).solvedCount,2);
visitRows.length=0;assert.equal(c.getThanksVisitState_('viewer',end,end).solvedCount,0);
console.log('PASS zero/multiple solvers, duplicate and unknown exclusion, missing count fallback, visited copy unchanged');

const source=fs.readFileSync(root+'js/script.js','utf8');
const saved=new Map();let rect={top:900,bottom:1200,height:300},renders=0;
const state=vm.createContext({Set,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},guestId:'Viewer',latestStatus:{dearGuest:{phase:'after',releaseAt:'release1'}},els:{overlay:{hidden:true}},window:{innerHeight:800},document:{hidden:false,getElementById:id=>id==='lastPuzzle'?{classList:{contains:()=>false}}:{children:[1],getBoundingClientRect:()=>rect}},renderMessage:()=>renders++});
vm.runInContext(source.slice(source.indexOf('  const viewedPuzzles'),source.indexOf('  let puzzleTimer')),state);
state.checkPuzzleViewed();assert.equal(state.hasViewedPuzzle(),false);
rect={top:400,bottom:700,height:300};state.els.overlay.hidden=false;state.checkPuzzleViewed();assert.equal(state.hasViewedPuzzle(),false);
state.els.overlay.hidden=true;state.checkPuzzleViewed();assert.equal(state.hasViewedPuzzle(),true);assert.equal(renders,1);
state.checkPuzzleViewed();assert.equal(renders,1);
vm.runInContext('viewedPuzzles.clear()',state);assert.equal(state.hasViewedPuzzle(),true);
state.guestId='Other';assert.equal(state.hasViewedPuzzle(),false);
state.guestId='Viewer';state.latestStatus.dearGuest.releaseAt='release2';assert.equal(state.hasViewedPuzzle(),false);
console.log('PASS visibility gate, overlay exclusion, reload persistence, guest and release isolation');
