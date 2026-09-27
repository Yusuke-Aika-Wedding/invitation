const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync('js/script.js','utf8');
const auth = source.slice(source.indexOf('  function setupAuth()'), source.indexOf('  let puzzleTimer'));
function fixture({ known = true, published = false, restored = false } = {}) {
  let revealed = 0, statusCalls = 0, opened = 0, saved;
  const storage = new Map([['yusuke-aika-wedding-guest-id-v1', 'Case_ID']]);
  const nodes = {};
  const element = () => ({ value:'', textContent:'', className:'', addEventListener(){}, focus(){}, select(){}, setAttribute(){}, after(node){nodes[node.id]=node;this.nextElementSibling=node;}, remove(){delete nodes[this.id];} });
  const entry=element(),copy=element();
  const visit={keyword:'thanks',eventId:'fixture-event-00001',guestId:known?'Case_ID':''};
  if(restored)visit.waitingForInvitationId=true;
  const c=vm.createContext({URLSearchParams, localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    location:{pathname:'/',search:restored?'?change-id=1':'',hash:restored?'#thanks-entry/thanks/fixture-event-00001':''},
    history:{replaceState:(_,__,url)=>{c.location.search=url.includes('?')?url.slice(url.indexOf('?')).split('#')[0]:'';c.location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}},
    document:{getElementById:id=>nodes[id]||null,querySelector:()=>copy,createElement:element},
    window:{WeddingAccess:{isKeyword:v=>['thanks','thankyou','manythanks'].includes(v.replace(/\s/g,'').toLowerCase()),createVisit:()=>({...visit}),currentVisit:()=>({...visit}),saveVisit:v=>{saved={...v};return v;},rememberGuest(){},openThanks(){opened++;},checkThanks:async v=>v.guestId==='Case_ID'?{ok:true,published,rank:1}:{ok:false,needsGuestId:true,published}}},
    normalizeGuestId:v=>String(v).trim(),setAuthLoading(){},setAuthStatus(){},isGasConfigured:()=>true,
    jsonp:async(action,p)=>{statusCalls++;return p.guestId==='Case_ID'?{ok:true,guestId:p.guestId}:{ok:false,error:'Invalid ID'};},
    hydrateGuest(){},revealAuthenticatedSite(){revealed++;},removeIdFromAddressBar(){},setupLastPuzzle(){}
  });
  c.entry=entry;
  vm.runInContext(`let thanksEntry=null,thanksEntryPending=false,thanksEntryRequiresId=false,guestId='',latestStatus={}; const GUEST_ID_STORAGE_KEY='yusuke-aika-wedding-guest-id-v1'; const els={authForm:{addEventListener(){}},guestIdEntry:entry};\n${auth}\nthis.state=()=>({thanksEntry,thanksEntryRequiresId});`,c);
  return {c,entry,nodes,storage,stats:()=>({revealed,statusCalls,opened,saved})};
}
(async()=>{
  let f=fixture(); await f.c.authenticateGuest('thanks');
  assert.equal(f.stats().revealed,0); assert.equal(f.stats().statusCalls,0);
  assert.equal(f.entry.value,''); assert.equal(f.nodes.thanksEntryHint.textContent,'そのIDは...少し待ってくださいね。');
  assert.equal(f.entry.nextElementSibling,f.nodes.thanksEntryHint);
  assert.equal(f.stats().saved.waitingForInvitationId,true); assert.equal(f.storage.size,0);
  assert.match(f.c.location.hash,/thanks-entry/);
  await f.c.authenticateGuest('missing'); assert.equal(f.stats().revealed,0); assert.equal(f.c.state().thanksEntryRequiresId,true);
  await f.c.authenticateGuest('Case_ID'); assert.equal(f.stats().revealed,1); assert.equal(f.c.state().thanksEntry,null); assert.equal(f.nodes.thanksEntryHint,undefined); assert.equal(f.c.location.hash,'');
  f=fixture({restored:true}); f.c.setupAuth(); assert.equal(f.stats().revealed,0); assert.equal(f.stats().statusCalls,0); assert.equal(f.c.state().thanksEntryRequiresId,true);
  await f.c.authenticateGuest('manythanks');assert.equal(f.stats().revealed,0);
  await f.c.authenticateGuest('Case_ID');assert.equal(f.stats().revealed,1);
  f=fixture({known:false}); await f.c.authenticateGuest('thanks'); await f.c.authenticateGuest('Case_ID'); assert.equal(f.stats().revealed,0); assert.equal(f.c.state().thanksEntryRequiresId,true);
  await f.c.authenticateGuest('Case_ID'); assert.equal(f.stats().revealed,1);
  f=fixture({published:true}); await f.c.authenticateGuest('thanks'); assert.equal(f.stats().opened,1);assert.equal(f.stats().revealed,0);
  console.log('PASS known/unknown IDs, prerelease waiting, hint below input, reload persistence, invalid IDs, manual reentry and published redirect');
})().catch(e=>{console.error(e);process.exitCode=1;});
