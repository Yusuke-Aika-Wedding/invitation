const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const c = vm.createContext({Date, Map, console});
for (const f of ['Code.gs','LastPuzzle.gs','DearGuest.gs']) vm.runInContext(fs.readFileSync(`gas/${f}`,'utf8'),c);
c.getWeddingSchedule_=()=>({start:new Date('2027-03-21T10:00:00+09:00'),end:new Date('2027-03-21T14:00:00+09:00')});
c.SpreadsheetApp={openById:()=>({getSheetByName:()=>({getRange:()=>({getValue:()=>new Date('2027-03-21T14:00:00+09:00')})})}),flush(){}};
const timing=c.getPredictionTiming_;
for(const [at,closed,published] of [['2027-01-31T23:59:59.999+09:00',false,false],['2027-02-01T00:00:00+09:00',true,false],['2027-03-21T14:00:00+09:00',true,true]]) {
 const t=timing(new Date(at));assert.equal(t.closed,closed);assert.equal(t.published,published);assert.equal(t.closesAt,'2027-01-31T15:00:00.000Z');
}
let rows=[],closed=false,writes=0;
c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
c.getMainSheet_=()=>({});c.ensureHeaders_=()=>{};c.findGuestRecord_=()=>({values:{id:'fixture',name:'Fixture',ceremony:'出席',reception:'出席'}});
const sheet={getLastRow:()=>rows.length+1,getRange:()=>({setValues(r){writes++;rows.push(...r)},setNumberFormat(){}})};
c.getPredictionSheet_=()=>sheet;c.readPredictionVotes_=()=>rows.map(r=>({guestId:r[0],questionId:r[2],option:r[3]}));
c.getPredictionTiming_=()=>({closed,published:false});
const q=vm.runInContext('PREDICTION_QUESTIONS[0]',c);
const single=()=>c.submitPrediction_({guestId:'fixture',questionId:q.id,option:q.options[0]});
const batch=()=>c.submitPredictions_({guestId:'fixture',answers:JSON.stringify([{questionId:q.id,option:q.options[0]}])});
closed=true;assert.throws(single,/回答は締め切りました/);assert.throws(batch,/回答は締め切りました/);assert.equal(writes,0);
closed=false;assert.equal(batch().ok,true);assert.equal(writes,1);closed=true;assert.equal(batch().alreadyVoted,true);assert.equal(writes,1);
const guest=c.rowToObject_(['fixture','Fixture','','出席','欠席','','','','','','','','','','振込完了']);assert.equal(guest.goshugiPay,'振込完了');
const data={name:'Fixture',invitationUrl:'https://yusuke-aika-wedding.com/',allergy:'なし'};
for(const ceremony of ['出席','欠席'])for(const reception of ['出席','欠席']) {
 const mail=c.buildConfirmationText_({...data,ceremonyAttendance:ceremony,receptionAttendance:reception});
 assert.ok(mail.includes('受付 9:30〜9:45'));assert.equal(mail.includes('またお会いできる日を楽しみにしております'),ceremony==='欠席'&&reception==='欠席');
 assert.equal(mail.includes('当日お会いできますことを'),ceremony==='出席'||reception==='出席');
}
for(const daysBefore of [1,7])assert.ok(c.buildReminderText_({...data,daysBefore}).includes('受付 9:30〜9:45'));
// RSVP must not erase the independently edited O column.
let writtenWidth=0;
c.getMainSheet_=()=>({getRange:(row,col,n,width)=>({setValues(values){writtenWidth=width;assert.equal(values[0].length,14)},setValue(){}})});
c.ensureHeaders_=()=>{};c.assertConfirmationEmailReady_=()=>{};c.sendConfirmationEmail_=()=>{};
c.findGuestRecord_=()=>({rowNumber:2,values:{id:'fixture',goshugiPay:'振込完了'}});
const response=c.submitResponse_({guestId:'fixture',name:'Fixture',email:'fixture@example.com',ceremonyAttendance:'出席',receptionAttendance:'欠席',allergyChoice:'なし'});
assert.equal(writtenWidth,14);assert.equal(response.goshugiPayCompleted,true);
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.attrs={};this.classes=new Set();this.classList={contains:n=>this.classes.has(n),toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n),remove:n=>this.classes.delete(n)};}
 setAttribute(k,v){this.attrs[k]=v} append(...kids){this.children.push(...kids)} replaceChildren(...kids){this.children=kids}
 get textContent(){return(this.value||'')+this.children.map(x=>x.textContent||'').join('')}set textContent(v){this.value=v;this.children=[]}
}
const section=new Element('section'),list=new Element('div'),intro=new Element('p'),rule=new Element('p'),deadline=new Element('span'),instructions=new Element('span');section.querySelector=s=>s==='.prediction-rule'?rule:intro;
const gift=new Element('section'),note=new Element('p'),link=new Element('a');note.innerHTML='original';gift.querySelector=s=>s==='.section-note'?note:link;
let now=Date.parse('2027-01-31T23:59:59+09:00');
Object.assign(c,{els:{predictionSection:section,predictionList:list},predictionSelections:new Map(),countdownServerTime:now,countdownSyncTime:0,performance:{now:()=>0},latestStatus:{completed:true,attending:true,dearGuest:{phase:'early'},goshugiPayCompleted:false},document:{getElementById:id=>({predictionDeadline:deadline,predictionInstructions:instructions,onlineGift:gift})[id],createElement:t=>new Element(t),createTextNode:t=>({textContent:t})}});
const source=fs.readFileSync('js/script.js','utf8');
vm.runInContext(source.slice(source.indexOf('  function renderOnlineGift('),source.indexOf('  function renderGiftInformation(')),c);
vm.runInContext(source.slice(source.indexOf('  function predictionQuestionText('),source.indexOf('  function setPredictionCardStatus(')),c);
const state={closed:false,published:false,closesAt:'2027-02-01T00:00:00+09:00',questions:[{id:'SONG',voted:false,options:q.options.map(label=>({label,percent:0}))}]};
c.renderPrediction(true,state);assert.equal(deadline.textContent,'回答締め切り：2027年1月31日(日)');assert.ok(list.children.some(e=>e.tag==='button'));
c.countdownServerTime=Date.parse('2027-02-01T00:00:00+09:00');c.renderPrediction(true,state);assert.equal(deadline.textContent,'回答は締め切りました');assert.equal(rule.hidden,false);assert.equal(list.children.some(e=>e.tag==='button'),false);assert.ok(list.children[0].children[0].children.every(e=>e.disabled));
state.questions[0].voted=true;c.renderPrediction(true,state);assert.equal(rule.hidden,false);
state.published=true;state.questions[0].winner=q.options[0];c.renderPrediction(true,state);assert.ok(list.textContent.includes('が選ばれました！！'));assert.equal(deadline.textContent,'回答は締め切りました');
c.renderOnlineGift();assert.equal(link.hidden,false);c.latestStatus.goshugiPayCompleted=true;c.renderOnlineGift();assert.equal(link.hidden,true);assert.equal(note.textContent,'オンラインご祝儀のご利用誠にありがとうございました');assert.equal(note.children[1].tag,'br');c.latestStatus.goshugiPayCompleted=false;c.renderOnlineGift();assert.equal(note.innerHTML,'original');assert.equal(link.hidden,false);
c.latestStatus.dearGuest.phase='after';c.renderOnlineGift();assert.ok(gift.classes.has('is-hidden'));
console.log('PASS JST deadline boundaries, single/batch rejection, duplicate safety, O-column preservation, attendance email branches, closed UI and paid/unpaid UI');
