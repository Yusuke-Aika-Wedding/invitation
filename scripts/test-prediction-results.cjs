const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const c = vm.createContext({ Date, Map, console });
for (const file of ['Code.gs', 'LastPuzzle.gs', 'DearGuest.gs']) vm.runInContext(fs.readFileSync(`gas/${file}`, 'utf8'), c);
const start = new Date('2027-03-21T10:00:00+09:00');
let release = new Date('2027-03-21T14:00:00+09:00');
c.getWeddingSchedule_ = () => ({start, end: release});
c.SpreadsheetApp = {openById: () => ({getSheetByName: name => {assert.equal(name, '公開設定'); return {getRange: range => {assert.equal(range, 'B3'); return {getValue: () => release};}};}})};
for (const [at, phase, published] of [
 ['2027-03-20T23:59:59+09:00','before',false],
 ['2027-03-21T00:00:00+09:00','today',false],
 ['2027-03-21T13:59:59+09:00','today',false],
 ['2027-03-21T14:00:00+09:00','after',true],
 ['2027-03-22T00:00:00+09:00','after',true]
]) { const timing = c.getPredictionTiming_(new Date(at)); assert.equal(timing.phase, phase); assert.equal(timing.published, published); }
for (const value of ['', 'invalid']) {release=value; assert.equal(c.getPredictionTiming_(new Date('2027-03-22T00:00:00+09:00')).published,false);}
const questions=vm.runInContext('PREDICTION_QUESTIONS',c);
assert.deepEqual(Array.from(questions[0].options),['ケーキ','シュークリーム','エクレア','その他']);
let published=false, score=0;
c.getPredictionTiming_=()=>({published,phase:published?'after':'before'});
c.getPredictionSheet_=()=>({});
c.readPredictionVotes_=()=>questions.flatMap((q,i)=>[
 {guestId:'Case_ID',questionId:q.id,option:i<score?q.answer:q.options.find(o=>o!==q.answer)},
 {guestId:'Other_ID',questionId:q.id,option:q.answer}
]);
const before=c.buildPredictionState_('Case_ID');
assert.equal(JSON.stringify(before).includes('"answer"'),false);
assert.equal(JSON.stringify(before).includes('"correct"'),false);
published=true;
for(score=0;score<=3;score++) {
 const result=c.buildPredictionState_('Case_ID');
 assert.equal(result.questions.filter(q=>q.correct).length,score);
 for(const q of result.questions) {assert.equal(q.totalVotes,2);assert.equal(q.options.reduce((n,o)=>n+o.count,0),2);assert.equal(q.options.reduce((n,o)=>n+o.percent,0),100);}
}
const missing=c.buildPredictionState_('case_id');
assert.ok(missing.questions.every(q=>q.correct===null && !q.voted));
// Exercise actual rendering without a browser or production data.
class Element {
 constructor(tag) {this.tag=tag;this.children=[];this.dataset={};this.style={};this.hidden=false;this.classList={contains:()=>false,toggle(){},remove(){}};}
 setAttribute(){} append(...children){this.children.push(...children);} replaceChildren(...children){this.children=children;}
 get textContent(){return (this.value||'')+this.children.map(c=>c.textContent||'').join('');} set textContent(v){this.value=v;this.children=[];}
}
const intro=new Element('p'),rule=new Element('p'),section=new Element('section'),list=new Element('div');
section.querySelector=s=>s==='.prediction-rule'?rule:intro;
c.latestStatus={dearGuest:{phase:"early"}};
c.els={predictionSection:section,predictionList:list};c.predictionSelections=new Map();
c.document={createElement:t=>new Element(t),createTextNode:t=>({textContent:t})};
const source=fs.readFileSync('js/script.js','utf8');
vm.runInContext(source.slice(source.indexOf('  function predictionQuestionText('),source.indexOf('  function setPredictionCardStatus(')),c);
for (score=0;score<=3;score++) {
 c.renderPrediction(true,c.buildPredictionState_('Case_ID'));
 const expected=score===0?'全問不正解...残念！':score===3?'全問正解！素晴らしい！':`3問中${score}問正解でした！`;
 assert.ok(list.textContent.includes('ご来場ありがとうございました！'+expected));
 assert.equal(intro.hidden,true);assert.equal(rule.hidden,true);assert.ok(list.textContent.includes('全2票'));assert.ok(list.textContent.includes('%'));
 assert.equal(list.children.filter(e=>e.tag==='button').length,0);
}
published=false;
for (const phase of ['before','today']) {
 const state=c.buildPredictionState_('Case_ID');state.phase=phase;c.renderPrediction(true,state);
 assert.ok(list.textContent.includes(phase==='today'?'本日お楽しみに！':'当日お楽しみに！'));
 assert.equal(intro.hidden,phase==='today');assert.equal(list.textContent.includes('正解は'),false);
}
console.log('PASS B3/JST boundaries, invalid dates, answer secrecy, counts, all scores, exact phase copy, unanswered guests');

c.latestStatus.dearGuest.phase='eve';
const eve=c.buildPredictionState_('Case_ID');eve.phase='before';c.renderPrediction(true,eve);
assert.ok(list.textContent.includes('明日お楽しみに！'));
assert.equal(c.predictionQuestionText({id:'Q3'}), '披露宴の最後で 新郎新婦の\n退場時に流れる曲は誰の曲？');
assert.equal(c.predictionQuestionText({id:'Q3'},true), '披露宴の最後で 新郎新婦の退場時\nに流れる曲は誰の曲？');
console.log('PASS eve completion and question/confirmation line breaks');
