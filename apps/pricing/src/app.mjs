import {customerIssues} from './proposal-policy.mjs';
import {mountWorkspace} from './workspace.mjs';
import {LINES as HCI_LINES,linesFor,money,whole,lookup,cost,calculateUnit,calculateProject,quoteDates} from './pricing.mjs';
import {generateQuote} from './quote-pdf.mjs';
import {exportWorkbook} from './quote-xlsx.mjs';
import {mountBidAssistant} from './bid-assistant.mjs';
import {mountTax} from './tax-ui.mjs';
import {newQuote} from './new-quote.mjs';
import {switchSupplier} from './supplier-switch.mjs';

const [HCI_DATA,HCI_IMAGES]=await Promise.all([fetch('./catalog.json').then(r=>r.json()),fetch('./catalog-images.json').then(r=>r.json())]);
let DATA=HCI_DATA,IMAGES=HCI_IMAGES,LINES=HCI_LINES;
const supplierCatalogs={hci:HCI_DATA};
async function supplierCatalog(id){
 if(!['hci','rythern','uscd'].includes(id))throw Error('Unknown supplier.');
 if(!supplierCatalogs[id]){const response=await fetch('./suppliers/'+id+'.json');if(!response.ok)throw Error('Supplier catalog could not load.');supplierCatalogs[id]=await response.json();}
 return supplierCatalogs[id];
}
const $=id=>document.getElementById(id);
$('exportExcel').onclick=async()=>{try{if(hosted){const bytes=await serverExport('xlsx');downloadBytes(bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',safeName()+'_Purchase_Bid.xlsx');}else{if(!window.XLSX)throw Error('The Excel tool is still loading. Try again.');exportWorkbook(window.XLSX,DATA,state);}toast('Purchase workbook exported with your units and quantities.')}catch(error){toast(error.message,{error:true})}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const natural=(a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'});
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const MAX=100000;

/* ------------------------------------------------------------------ state */
// Unit defaults and explicit item finishes preserve mixed-finish quotes.
const KEY='vulpine-project-v4';
const hosted=location.pathname.startsWith('/api/cabinet-pricing/');
let revision=null,saveTimer,saveQueue=Promise.resolve(),serverConflict=false;
let agentJob=null,historyRef=null,projectArchived=false,recordDeleted=false;
const freshUnit=n=>({id:uid(),name:'Unit '+n,repeat:1,auto:true,defaultLi:0,items:[]});
let state=newQuote();
let storageWarning=false;
try{
  const saved=hosted?null:JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('vulpine-project-v2')||localStorage.getItem('vulpine-project-v3'));
  if(saved?.version===2&&Array.isArray(saved.units)&&saved.units.length&&saved.units.every(u=>Array.isArray(u.items)&&typeof u.name==='string')){
    state={...state,...saved};
    if(!Number.isInteger(state.margin)||state.margin<1||state.margin>50)state.margin=20;
  }
}catch{storageWarning=true}
if(hosted){
  const back=document.createElement('a');back.href='/';back.textContent='← Back office';back.className='backofficeLink';document.querySelector('.topRight').prepend(back);
  const response=await fetch('./draft',{cache:'no-store'});
  if(!response.ok)throw Error('Could not load your server draft. Reload after signing in.');
  const saved=await response.json();revision=saved.revision;
  if(saved.draft)state=saved.draft;
  const quoteId=new URLSearchParams(location.search).get('quote')||state._history?.id;
  if(quoteId){if(!/^[a-f0-9-]{36}$/.test(quoteId))throw Error('Invalid quote link.');const r=await fetch('./quotes/'+quoteId);if(r.status===404){state=newQuote();projectArchived=recordDeleted=true;}else{if(!r.ok)throw Error('Saved quote could not load.');const loaded=await r.json();state=loaded.state;projectArchived=loaded.archived===true;}}
  historyRef=state._history||null;
  $('saveState').textContent=projectArchived?'Archived or deleted — start a new quote':'Saved in back office';
  const bidId=new URLSearchParams(location.search).get('bid');
  if(bidId){
    if(!/^[a-f0-9-]{36}$/.test(bidId))throw Error('Invalid bid link.');
    const r=await fetch('./agent/jobs/'+bidId,{cache:'no-store'});
    if(r.status===404){state=newQuote();historyRef=null;projectArchived=recordDeleted=true;$('saveState').textContent='Bid deleted — start a new quote';}
    else{if(!r.ok)throw Error('This bid could not be loaded. Your existing draft is retained.');
     agentJob=await r.json();historyRef=null;projectArchived=recordDeleted=false;state=structuredClone(agentJob.state);
     if(!state.units.length)state.units=[freshUnit('01')];
     $('saveState').textContent='Saved bid · revision '+agentJob.revision;}

  }
}
if(!['Daniel Cruz','Mike Musonda'].includes(state.preparedBy))state.preparedBy='Daniel Cruz';
let supplierDrafts=state.supplierDrafts||{};delete state.supplierDrafts;
state.supplier=state.supplier||'hci';DATA=await supplierCatalog(state.supplier);LINES=linesFor(DATA);IMAGES=state.supplier==='hci'?HCI_IMAGES:{};
for(const u of state.units){u.defaultLi=LINES[u.defaultLi]?u.defaultLi:(u.items.find(x=>LINES[x.li])?.li??state.finish??0);for(const it of u.items)it.finishOverride=it.finishOverride??(it.li!==u.defaultLi);}

let view='cost';try{view=localStorage.getItem('vulpine-view')==='sell'?'sell':'cost'}catch{}
let active=state.units[0].id,step='build',documentType='customer',pdfUrl=null,flashSku=null;

let taxUI;
const unit=()=>state.units.find(u=>u.id===active)||state.units[0];
const selectedFinish=()=>unit().defaultLi;
const fam=()=>LINES[selectedFinish()][1];
const finishName=()=>LINES[selectedFinish()][0];
const project=()=>calculateProject(DATA,state);
const unitCalc=()=>calculateUnit(DATA,unit(),state.margin);

/* ---------------------------------------------------------------- catalog */
const category=r=>{if(r[5])return 'Cabinets';if(/scribe|mold|crown|toe kick|trim|light rail/i.test(r[1]+' '+r[0]))return 'Trim & molding';if(/panel|filler|skin/i.test(r[1]))return 'Panels & fillers';return 'Kits & accessories'};
const cabType=r=>{const d=r[1];if(/vanity/i.test(d))return 'Vanity';if(/pantry|oven|linen/i.test(d))return 'Tall';if(/wall/i.test(d)||/^W/i.test(r[0]))return 'Wall';return 'Base'};
const CATS=['Cabinets','Trim & molding','Panels & fillers','Kits & accessories'],TYPES=['Base','Wall','Tall','Vanity'];
const rowCache={};
const rowsFor=f=>rowCache[f]??=DATA[f].map(r=>({r,cat:category(r),type:r[5]?cabType(r):'',hay:norm(r[0]+' '+r[1]),sku:norm(r[0])}));
const price=sku=>cost(DATA,selectedFinish(),sku);
const assetPath=s=>s?.startsWith('/')?'.'+s:(s||'');
const thumb=(sku,li=selectedFinish())=>assetPath(IMAGES[LINES[li][1]]?.[sku]?.src);
const qtyOf=(sku,li=selectedFinish())=>unit().items.find(x=>x.sku===sku&&x.li===li)?.qty||0;
const autoBlocked=sku=>DATA.autoToe!==false&&unit().auto&&sku==='TK8';

function search(q,limit=8){
  const terms=norm(q).split(' ').filter(Boolean);if(!terms.length)return[];
  const out=[];
  for(const e of rowsFor(fam())){
    if(!terms.every(t=>e.hay.includes(t)))continue;
    const t0=terms[0];
    const score=e.sku===norm(q)||norm(e.r[12]?.baseSku||'')===norm(q)?0:e.sku===t0?0:e.sku.startsWith(t0)?1:e.sku.includes(t0)?2:3;
    out.push([score,e]);
  }
  out.sort((a,b)=>a[0]-b[0]||natural(a[1].r[0],b[1].r[0]));
  return out.slice(0,limit).map(x=>x[1]);
}

/* ---------------------------------------------------------------- helpers */
function toast(message,opts={}){
  const el=document.createElement('div');el.className='toast'+(opts.error?' error':'');
  const span=document.createElement('span');span.textContent=message;el.append(span);
  if(opts.action){const b=document.createElement('button');b.textContent=opts.action.label;b.onclick=()=>{opts.action.fn();el.remove()};el.append(b)}
  $('toasts').append(el);setTimeout(()=>el.remove(),opts.action?7000:3800);
}
function save(){
  if(projectArchived||recordDeleted)return;
  if(hosted){
    $('saveState').textContent='Saving to back office…';clearTimeout(saveTimer);
    const snapshot=structuredClone({...state,supplierDrafts});
    saveTimer=setTimeout(()=>{saveQueue=saveQueue.then(async()=>{
      if(serverConflict)throw Error('Draft changed in another tab. Reload before editing.');
      const jobState=agentJob?cleanJobState(snapshot):null;
      const r=await fetch(agentJob?'./agent/jobs/'+agentJob.id:'./draft',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(agentJob?{state:jobState,expected_revision:agentJob.revision}:{draft:{...snapshot,_history:historyRef},revision})});
      const result=await r.json();if(!r.ok){if(r.status===409)serverConflict=true;throw Error(result.error||'Server save failed.');}
      if(agentJob)agentJob=result;else {revision=result.revision;historyRef=result.draft?._history||historyRef;}$('saveState').textContent='Saved in back office';
    }).catch(error=>{$('saveState').textContent='Not saved';toast(error.message,{error:true})});},400);
  }else try{localStorage.setItem(KEY,JSON.stringify({...state,supplierDrafts}));$('saveState').textContent='Saved on this device'}
  catch{$('saveState').textContent='Not saved — browser storage is off';if(!storageWarning){toast('Browser storage is off. Download your PDF before you close this page.',{error:true});storageWarning=true}}
  invalidatePdf();
}
function invalidatePdf(){if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null}$('downloadResult').hidden=true}
function cleanJobState(s){return Object.fromEntries(['version','supplier','project','status','quoteId','date','validUntil','customer','email','preparedBy','notes','margin','comparison','pricingPolicy','projectInfo','charges','customerSections','signature','revisionOf','tax','units'].map(k=>[k,k==='status'?'Tentative':k==='units'?s.units.map(u=>({id:u.id,name:u.name,repeat:u.repeat,defaultLi:u.defaultLi,auto:u.auto,kind:u.kind,areaId:u.areaId,areas:u.areas,items:u.items.map(i=>({sku:i.sku,li:i.li,qty:i.qty,handleCount:i.handleCount,handlesIncluded:i.handlesIncluded,handleInclusion:i.handleInclusion,assemblyId:i.assemblyId}))})):s[k]]));}
document.addEventListener('vulpine-open-studio',async()=>{
  // Let the existing debounced save finish before leaving the pricing document.
  await new Promise(resolve=>setTimeout(resolve,450));await saveQueue;
  if(serverConflict||$('saveState').textContent==='Not saved'){toast('Save your pricing changes before opening Studio.',{error:true});return;}
  location.assign('./studio/index.html');
});
const safeName=()=>((state.quoteId||'Vulpine')+'_'+(state.project||'Project')).replace(/[^a-z0-9_-]/gi,'_');
async function serverExport(format,type=documentType){await flushWorkspace();const response=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:{...structuredClone(state),supplierDrafts,_history:agentJob?null:historyRef},format,type})});if(!response.ok){const data=await response.json();throw Error(data.error?.message||data.error||'Export failed.');}return new Uint8Array(await response.arrayBuffer());}
function downloadBytes(bytes,mime,name){const url=URL.createObjectURL(new Blob([bytes],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function refreshDates(){Object.assign(state,quoteDates());$('date').value=state.date;$('validUntil').value=state.validUntil}

/* ------------------------------------------------------------- unit edits */
function setQty(sku,q,{silent=false,li=selectedFinish()}={}){
  const u=unit();let it=u.items.find(x=>x.sku===sku&&x.li===li);
  q=Math.max(0,Math.min(MAX,Math.floor(Number.isFinite(q)?q:0)));
  if(q===0){
    if(!it)return;
    const index=u.items.indexOf(it);u.items.splice(index,1);
    save();refreshUnit();
    if(!silent)toast('Removed '+sku,{action:{label:'Undo',fn:()=>{if(!state.units.includes(u))return;const existing=u.items.find(x=>x.sku===it.sku&&x.li===it.li);if(existing)existing.qty=Math.min(MAX,existing.qty+it.qty);else u.items.splice(Math.min(index,u.items.length),0,it);save();refreshUnit()}}});
    return;
  }
  if(it)it.qty=q;else u.items.push({li,sku,qty:q,finishOverride:li!==u.defaultLi});
  save();refreshUnit();
}
function addItem(sku,n=1){
  if(autoBlocked(sku)){toast('Toe kicks are automatic in this unit. Untick “Add toe kicks for me” to add them by hand.',{error:true});return false}
  if(price(sku)===null){toast(sku+' has no price in this catalog, so it can’t be quoted.',{error:true});return false}
  const have=qtyOf(sku);
  if(have+n>MAX){toast('That’s more than 100,000.',{error:true});return false}
  flashSku=sku;setQty(sku,have+n);return true;
}
function refreshUnit(){renderUnits();renderItems();renderBar();updateDrawerFooter();if(step==='quote')renderQuote()}

function changeFinish(next){
  const u=unit(),affected=u.items.filter(x=>!x.finishOverride);
  if(affected.some(x=>u.items.some(y=>y!==x&&y.finishOverride&&y.li===next&&y.sku===x.sku))){toast('This unit already has an overridden item in that finish. Adjust its quantity first.',{error:true});renderFinish();return;}
  if(affected.some(x=>cost(DATA,next,x.sku)===null)){
    toast('This finish has unavailable items. Keep this finish or change those items individually.',{error:true});renderFinish();return;
  }
  u.defaultLi=next;for(const it of affected)it.li=next;
  save();renderFinish();renderAll();
  toast('Unit finish updated. Item overrides are preserved.');
}
function finishOptions(value){return LINES.map((l,i)=>'<option value="'+i+'"'+(i===value?' selected':'')+'>'+esc(l[0])+'</option>').join('')}

/* ----------------------------------------------------------------- render */
function renderFinish(){
  $('finish').innerHTML=finishOptions(selectedFinish());
  $('finish').value=selectedFinish();
  const sw=IMAGES.finishes?.[finishName()]?.src;$('finishSwatch').src=assetPath(sw);$('finishSwatch').style.visibility=sw?'visible':'hidden';
  $('supplier').value=state.supplier||'hci';
  document.querySelector('.factor').textContent=DATA.basis||'HCI purchase pricing · 0.204';
  $('autoToe').disabled=DATA.autoToe===false;
  $('autoToe').closest('label').hidden=DATA.autoToe===false;
  $('supplierNotice').textContent=state.supplier==='hci'?'':state.supplier==='rythern'?'Rythern September 2026 DDP. Exact source SKUs; enter trim separately. Cabinet and hardware counts are not supplied in this price sheet.':'USCD captured purchase pricing. Select RTA or Assembled with the finish. Freight and project-specific modifications require separate quotes.';
}
function renderUnits(){
  const p=project();
  $('unitList').innerHTML=p.units.map(u=>{
    const bad=u.repeat!==0&&(u.issues.length||!u.entries.length);
    const sub=u.repeat===0?'<span class="pill">Left out</span>':'<span>'+u.entries.length+' item'+(u.entries.length===1?'':'s')+'</span>';
    const total=u.repeat===0?'':'<span class="uTotal">'+(u.issues.length?'Check items':money(u.sale*u.repeat))+'</span>';
    const id=u.id;
    return '<div class="unitCard'+(id===active?' on':'')+(bad&&u.entries.length?' warn':'')+'" data-unit="'+id+'">'
      +'<div class="uTop"><input class="uName" data-uname="'+id+'" value="'+esc(u.name)+'" maxlength="80" enterkeyhint="done" autocomplete="off" aria-label="Unit name">'
      +'<div class="stepper mini"><button type="button" data-urep="-1" data-uid="'+id+'" aria-label="One fewer of this unit">−</button><input type="number" min="0" max="'+MAX+'" step="1" inputmode="numeric" value="'+(whole(u.repeat)?u.repeat:'')+'" data-urepin="'+id+'" aria-label="How many of this unit"><button type="button" data-urep="1" data-uid="'+id+'" aria-label="One more of this unit">+</button></div></div>'
      +'<div class="uSub">'+sub+total+'</div>'
      +'<div class="uAct"><button type="button" class="ghost" data-udup="'+id+'">Duplicate</button><button type="button" class="ghost danger" data-udel="'+id+'">Delete</button></div>'
      +'</div>';
  }).join('');
}
function selectUnit(id){
  if(id===active)return;
  active=id;const u=unit();renderFinish();
  $('unitName').value=u.name;$('repeat').value=whole(u.repeat)?u.repeat:'';$('autoToe').checked=!!u.auto;
  document.querySelectorAll('.unitCard').forEach(c=>c.classList.toggle('on',c.dataset.unit===id));
  renderItems();renderBar();updateDrawerFooter();
  if(step==='quote')renderQuote();
}
function setRepeatFor(id,v){
  const u=state.units.find(x=>x.id===id);if(!u)return;
  u.repeat=v;save();
  if(id===active)$('repeat').value=v===-1?'':v;
  refreshUnit();
}
function duplicateUnit(id){
  const i=state.units.findIndex(u=>u.id===id);if(i<0)return;
  const copy=structuredClone(state.units[i]);copy.id=uid();copy.name+=' copy';
  state.units.splice(i+1,0,copy);active=copy.id;save();loadUnit();
  if(matchMedia('(min-width:901px)').matches)$('unitName').select();
  toast('Copied with every item and quantity. Rename it and change what’s different.');
}
function deleteUnit(id){
  const i=state.units.findIndex(u=>u.id===id);if(i<0)return;
  const [gone]=state.units.splice(i,1);let fresh=null;
  if(!state.units.length){fresh=freshUnit('01');state.units.push(fresh)}
  if(active===id)active=state.units[Math.min(i,state.units.length-1)].id;
  save();loadUnit();
  toast('Deleted “'+gone.name+'”',{action:{label:'Undo',fn:()=>{if(fresh)state.units=state.units.filter(x=>x!==fresh);state.units.splice(Math.min(i,state.units.length),0,gone);active=gone.id;save();loadUnit()}}});
}
function loadUnit(){
  const u=unit();renderFinish();
  $('unitName').value=u.name;$('repeat').value=whole(u.repeat)?u.repeat:'';$('autoToe').checked=!!u.auto;
  refreshUnit();
}
function renderItems(){
  const u=unit(),r=unitCalc();
  $('listTitle').textContent=r.entries.length?'What’s in '+u.name:'What’s in this unit';
  $('repeatNote').hidden=u.repeat!==0;$('repeatNote').textContent=u.repeat===0?'This unit is set to 0, so it’s left out of the quote. Set it to 1 or more to include it.':'';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  if(!r.entries.length){
    $('items').innerHTML='<div class="empty"><b>Nothing in here yet.</b><span>Type a SKU or name in the box above and press Enter, or</span><button type="button" class="secondary" data-open-browse>Browse the catalog</button></div>';
  }else{
    const groups=new Map();
    for(const x of r.entries){const row=lookup(DATA,x.li,x.sku),c=row?category(row):'Kits & accessories';if(!groups.has(c))groups.set(c,[]);groups.get(c).push({x,row})}
    let html='';
    for(const c of CATS){
      const list=groups.get(c);if(!list)continue;
      html+='<div class="group"><h3>'+c+'</h3>';
      for(const {x,row} of list){
        const unit1=view==='sell'?x.sale:x.purchase,t=thumb(x.sku,x.li);
        const note=[row?.[11],row?.[8]?'needs '+row[8]:''].filter(Boolean).join(' · ');
        html+='<div class="row'+(x.sku===flashSku?' flash':'')+'" data-li="'+x.li+'" data-row="'+esc(x.sku)+'">'
          +(t?'<img class="thumb" src="'+esc(t)+'" alt="" loading="lazy" width="48" height="48">':'<span class="thumb none"></span>')
          +'<div class="rowText"><b>'+esc(x.sku)+(x.auto?' <span class="pill">Auto</span>':'')+'</b><span>'+esc(x.description)+'</span>'+(note?'<small>'+esc(note)+'</small>':'')+(x.auto?'<small>'+esc(x.line)+'</small>':'<label class="itemFinish"><span>Finish</span><select data-item-finish="'+esc(x.sku)+'" aria-label="Finish for '+esc(x.sku)+'">'+finishOptions(x.li)+'</select></label>')
          +(unit1===null?'<label class="itemFinish">Replacement SKU<input data-replace="'+esc(x.sku)+'" aria-label="Replacement SKU for '+esc(x.sku)+'" placeholder="Exact supplier SKU"><button type="button" data-apply-replacement>Replace</button></label>':'')+'</div>'
          +'<div class="rowEach">'+(unit1===null?'<span class="bad">SKU / finish needs review</span>':money(unit1)+'<small>each</small>')+'</div>'
          +(x.auto?'<div class="rowQty autoQty">'+x.qty+' stick'+(x.qty===1?'':'s')+'</div>'
            :'<div class="stepper"><button type="button" data-dec="'+esc(x.sku)+'" aria-label="One fewer '+esc(x.sku)+'">'+(x.qty===1?'×':'−')+'</button><input type="number" min="0" max="'+MAX+'" step="1" inputmode="numeric" value="'+x.qty+'" data-qty="'+esc(x.sku)+'" aria-label="Quantity of '+esc(x.sku)+'"><button type="button" data-inc="'+esc(x.sku)+'" aria-label="One more '+esc(x.sku)+'">+</button></div>')
          +'<div class="rowTotal">'+(unit1===null?'—':money(unit1*x.qty))+'</div></div>';
      }
      html+='</div>';
    }
    const perUnit=view==='sell'?r.sale:r.purchase;
    html+='<div class="unitTotal"><span>One '+esc(u.name)+' ('+(view==='sell'?'sell':'your cost')+')</span><b>'+(r.issues.length?'Check items':money(perUnit))+'</b></div>';
    if(u.repeat>1&&!r.issues.length)html+='<div class="unitTotal sub"><span>× '+u.repeat+' units</span><b>'+money(perUnit*u.repeat)+'</b></div>';
    $('items').innerHTML=html;
    if(flashSku){const el=$('items').querySelector('.flash');el?.scrollIntoView({block:'nearest',behavior:'smooth'});flashSku=null}
  }
  // Missing required parts become one-click fixes instead of an error.
  const fixes=[],handled=new Set();
  for(const x of r.entries){
    const row=lookup(DATA,x.li,x.sku);if(!row||!row[8])continue;
    const need=r.entries.filter(y=>y.li===x.li&&y.sku===x.sku).reduce((s,y)=>s+y.qty,0);
    const have=r.entries.filter(y=>y.li===x.li&&y.sku===row[8]).reduce((s,y)=>s+y.qty,0);
    if(have>=need)continue;
    const req=lookup(DATA,x.li,row[8]);if(!req||cost(DATA,x.li,row[8])===null)continue;
    handled.add(x.sku+': add '+need+' × '+row[8]+' in this unit.');
    fixes.push({li:x.li,for:x.sku,sku:row[8],qty:need-have,desc:req[1]});
  }
  $('fixes').innerHTML=fixes.map(f=>'<div class="fix"><span><b>'+esc(f.for)+'</b> needs <b>'+f.qty+' × '+esc(f.sku)+'</b> <small>'+esc(f.desc)+'</small></span><button type="button" class="secondary" data-li="'+f.li+'" data-fix="'+esc(f.sku)+'" data-n="'+f.qty+'">Add '+f.qty+' × '+esc(f.sku)+'</button></div>').join('');
  $('issues').textContent=r.issues.filter(i=>!handled.has(i)).join('\n');$('issues').hidden=!$('issues').textContent;
}
function renderBar(){
  const r=project(),ok=Number.isSafeInteger(r.purchase)&&Number.isSafeInteger(r.sale);
  taxUI?.draw(r.sale);
  $('tCost').textContent=ok?money(r.knownSupplierTotal):'—';$('tSell').textContent=ok?money(r.sale):'—';$('tProfit').textContent=ok?money(r.profit):'—';
  $('tProfitLabel').textContent=r.costsComplete?'Profit':'Estimated profit';
  $('tReal').textContent=ok&&r.sale?r.actualMargin.toFixed(2)+'%'+(r.costsComplete?' margin':' · before remaining supplier costs'):'';
  $('mVal').textContent=state.margin+'%';$('mTog').textContent=state.margin+'%';$('mRange').value=state.margin;
  $('mChips').innerHTML=[20,25,30,33,35,40].map(m=>'<button type="button" data-m="'+m+'" aria-pressed="'+(m===state.margin)+'">'+m+'</button>').join('');
  const warn=$('barWarn'),bad=r.units.filter(u=>u.repeat!==0&&u.entries.length&&u.issues.length).length;
  if(r.issues.length&&step==='build'){warn.hidden=false;warn.textContent='Provisional totals — finish checking units'}else warn.hidden=true;
  $('next').textContent=step==='build'?'Make the quote →':'← Back to units';
  $('next').className=step==='build'?'primary':'secondary';
}
function setMargin(n){
  n=Math.max(1,Math.min(50,Math.round(n)));if(n===state.margin)return;
  state.margin=n;save();renderUnits();renderItems();renderBar();if(step==='quote')renderQuote();
}
function renderAll(){renderUnits();renderItems();renderBar();updateDrawer();if(step==='quote')renderQuote()}

/* ------------------------------------------------------------ quote step */
function renderQuote(){
  const r=project(),ok=!r.issues.length;
  $('unitSummary').innerHTML=r.units.map(u=>'<tr><td><button type="button" class="link" data-edit-unit="'+u.id+'">'+esc(u.name)+'</button><br><select data-unit-kind="'+u.id+'" aria-label="Area type"><option value="apartment" '+(u.kind!=='amenity'?'selected':'')+'>Apartments</option><option value="amenity" '+(u.kind==='amenity'?'selected':'')+'>Named amenity area</option></select>'+(u.repeat===0?' <span class="pill">left out</span>':'')+'</td><td class="num"><input class="inl" type="number" min="0" max="'+MAX+'" step="1" inputmode="numeric" value="'+(whole(u.repeat)?u.repeat:'')+'" data-srep="'+u.id+'" aria-label="How many of '+esc(u.name)+'"></td><td class="num">'+money(u.purchase)+'</td><td class="num">'+money(u.purchase*u.repeat)+'</td><td class="num">'+money(u.sale*u.repeat)+'</td><td class="num">'+money(u.profit*u.repeat)+'</td></tr>').join('')
    +'<tr class="totalRow"><td>Total</td><td class="num">'+r.count+'</td><td></td><td class="num">'+(ok?money(r.purchase):'—')+'</td><td class="num">'+(ok?money(r.sale):'—')+'</td><td class="num">'+(ok?money(r.profit):'—')+'</td></tr>';
  const problems=documentType==='customer'?customerIssues(DATA,state,r):[...r.issues];
  if(!state.quoteId.trim())problems.push('Enter a quote number.');
  if(!state.date)problems.push('Enter a quote date.');
  if(state.email&&!$('email').validity.valid)problems.push('That customer email doesn’t look right. Fix it or leave it blank.');
  $('documentIssues').textContent=problems.join('\n');$('documentIssues').hidden=!problems.length;
  $('generate').disabled=$('printGenerate').disabled=problems.length>0;
  const amount=documentType==='purchase'?r.purchase:r.total??r.sale;
  $('documentSummary').innerHTML='<p class="sumName">'+esc(state.project||'Unnamed project')+'<br><small>'+esc([...new Set(r.units.filter(u=>u.repeat>0).flatMap(u=>u.entries.map(x=>x.line)))].join(', '))+' · '+r.count+' unit'+(r.count===1?'':'s')+' · '+esc(state.status)+'</small></p><strong class="sumAmt">'+(ok?money(amount):'Check units')+'</strong><p class="hint">'+(documentType==='customer'?'Customer selling total. Your cost and profit are hidden.':documentType==='purchase'?'Supplier purchase total. Shipping and delivery use full catalog rates.':'Internal document: shows cost, selling price, margin and profit.')+'</p>';
  $('chargeSummary').innerHTML=r.charges?'<p>'+r.charges.counts.apartments+' apartments + '+r.charges.counts.amenities+' named amenity areas; '+r.charges.boxes+' cabinet boxes; '+r.charges.accessories+' accessories.</p><div><span>Handles: '+r.charges.handles.chargedQuantity+' × $3.33</span><strong>'+money(r.charges.handles.amount)+'</strong></div><div><span>Shipping: '+r.charges.freight.quantity+' × '+money(r.charges.freight.rate)+'</span><strong>'+money(r.charges.freight.amount)+'</strong></div><div><span>Tax <a href="#projectTax">Enter / edit rate</a></span><strong>'+(r.tax.amount===null||(!state.tax?.enabled&&!state.tax?.exemption)?'Enter a tax rate':money(r.tax.amount))+'</strong></div>':'';
  $('comparisonPdf').disabled=documentType!=='internal';
}
function go(next){
  step=next;refreshDates();
  $('buildStep').hidden=step!=='build';$('quoteStep').hidden=step!=='quote';
  document.querySelectorAll('.steps [data-step]').forEach(b=>b.setAttribute('aria-current',b.dataset.step===step?'step':'false'));
  renderBar();if(step==='quote')renderQuote();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ------------------------------------------------------------- quick add */
let qResults=[],qIndex=0;
function parseQuick(text){
  const m=text.match(/^(.+?)(?:\s+x\s*|\s*[*×]\s*)(\d{1,5})$/i);
  return m?{q:m[1].trim(),n:Math.max(1,+m[2])}:{q:text.trim(),n:1};
}
function renderQuick(){
  const {q}=parseQuick($('quick').value);qResults=q?search(q):[];qIndex=Math.min(qIndex,Math.max(0,qResults.length-1));
  const list=$('quickList');
  if(!q){list.hidden=true;$('quick').setAttribute('aria-expanded','false');return}
  list.hidden=false;$('quick').setAttribute('aria-expanded','true');
  list.innerHTML=qResults.length?qResults.map((e,i)=>{const c=price(e.r[0]);return '<li role="option" id="qo'+i+'" data-i="'+i+'" aria-selected="'+(i===qIndex)+'" class="'+(i===qIndex?'on':'')+'"><b>'+esc(e.r[0])+'</b><span>'+esc(e.r[1])+'</span><em>'+(c===null?'No price':money(c))+'</em></li>'}).join(''):'<li class="none">No match in '+esc(finishName())+'. Try fewer words, or Browse catalog.</li>';
  $('quick').setAttribute('aria-activedescendant',qResults.length?'qo'+qIndex:'');
}
function commitQuick(i=qIndex){
  const {n}=parseQuick($('quick').value),e=qResults[i];
  if(!e){toast('No match. Try a different SKU or name.',{error:true});return}
  if(addItem(e.r[0],n)){$('quick').value='';qResults=[];renderQuick();$('quick').focus()}
}
$('quick').addEventListener('input',()=>{qIndex=0;renderQuick()});
$('quick').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(qResults.length){qIndex=(qIndex+1)%qResults.length;renderQuick()}}
  else if(e.key==='ArrowUp'){e.preventDefault();if(qResults.length){qIndex=(qIndex-1+qResults.length)%qResults.length;renderQuick()}}
  else if(e.key==='Enter'){e.preventDefault();commitQuick()}
  else if(e.key==='Escape'){$('quickList').hidden=true;$('quick').setAttribute('aria-expanded','false')}
});
$('quickList').addEventListener('mousedown',e=>{const li=e.target.closest('li[data-i]');if(li){e.preventDefault();commitQuick(+li.dataset.i)}});
$('quick').addEventListener('blur',()=>setTimeout(()=>{$('quickList').hidden=true},120));
$('quick').addEventListener('focus',renderQuick);
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')&&step==='build'){e.preventDefault();$('quick').focus()}
});

/* ------------------------------------------------------------ catalog drawer */
const dui={q:'',cat:'Cabinets',type:'All',limit:80};
function openDrawer(){
  dui.q='';$('dSearch').value='';dui.limit=80;
  $('drawerSub').textContent='Adding to “'+unit().name+'” · '+finishName();
  renderDrawerChips();renderDrawerList();updateDrawerFooter();
  $('drawer').showModal();updateDrawerFooter();$('dSearch').focus();
}
function closeDrawer(){$('drawer').close()}
function renderDrawerChips(){
  $('dCats').innerHTML=CATS.map(c=>'<button type="button" data-dcat="'+esc(c)+'" aria-pressed="'+(dui.cat===c)+'">'+c+'</button>').join('')+'<button type="button" data-dcat="All" aria-pressed="'+(dui.cat==='All')+'">Everything</button>';
  $('dTypes').hidden=dui.cat!=='Cabinets'&&dui.cat!=='All';
  $('dTypes').innerHTML=['All',...TYPES].map(t=>'<button type="button" data-dtype="'+t+'" aria-pressed="'+(dui.type===t)+'">'+(t==='All'?'All types':t)+'</button>').join('');
}
function drawerRows(){
  const terms=norm(dui.q).split(' ').filter(Boolean);
  const rows=rowsFor(fam()).filter(e=>(dui.cat==='All'||e.cat===dui.cat)&&(dui.type==='All'||e.type===dui.type)&&terms.every(t=>e.hay.includes(t)));
  const grouped=dui.cat==='Cabinets'&&dui.type==='All';
  return rows.sort((a,b)=>(grouped?TYPES.indexOf(a.type)-TYPES.indexOf(b.type):0)||natural(a.r[0],b.r[0]));
}
function drawerRowHtml(e){
  const sku=e.r[0],c=price(sku),q=qtyOf(sku),t=thumb(sku),blocked=autoBlocked(sku);
  return '<div class="dRow'+(q?' in':'')+'" data-drow="'+esc(sku)+'">'
    +(t?'<img class="thumb" src="'+esc(t)+'" alt="" loading="lazy" width="48" height="48">':'<span class="thumb none"></span>')
    +'<div class="rowText"><b>'+esc(sku)+'</b><span>'+esc(e.r[1])+'</span>'+(e.r[8]?'<small>needs '+esc(e.r[8])+'</small>':'')+(blocked?'<small>Automatic in this unit</small>':'')+'</div>'
          +'<div class="rowEach">'+(c===null?'<span class="bad">SKU / finish needs review</span>':money(c))+'</div>'
    +(c===null||blocked?'<div class="stepper off"></div>':'<div class="stepper"><button type="button" data-ddec="'+esc(sku)+'" aria-label="One fewer '+esc(sku)+'"'+(q?'':' disabled')+'>−</button><input type="number" min="0" max="'+MAX+'" step="1" inputmode="numeric" value="'+q+'" data-dqty="'+esc(sku)+'" aria-label="Quantity of '+esc(sku)+' in this unit"><button type="button" data-dinc="'+esc(sku)+'" aria-label="Add one '+esc(sku)+'">+</button></div>')
    +'</div>';
}
function renderDrawerList(){
  const rows=drawerRows(),shown=rows.slice(0,dui.limit);
  $('dList').innerHTML=(shown.map(drawerRowHtml).join('')||'<div class="empty"><b>No matches.</b><span>Try fewer words or another category.</span></div>')
    +(rows.length>shown.length?'<button type="button" class="secondary more" data-more>Show '+Math.min(80,rows.length-shown.length)+' more ('+(rows.length-shown.length)+' left)</button>':'');
}
function updateDrawer(){if($('drawer').open){renderDrawerList();updateDrawerFooter()}}
function updateDrawerRow(sku){
  const el=$('dList').querySelector('[data-drow="'+CSS.escape(sku)+'"]');if(!el)return;
  const e=rowsFor(fam()).find(x=>x.r[0]===sku);if(e)el.outerHTML=drawerRowHtml(e);
}
function updateDrawerFooter(){
  if(!$('drawer').open)return;
  const r=unitCalc();$('dFoot').textContent=unit().name+': '+r.entries.length+' item'+(r.entries.length===1?'':'s')+' · '+(r.issues.length?'check items':money(view==='sell'?r.sale:r.purchase)+' per unit');
}
$('browse').onclick=openDrawer;
$('drawerClose').onclick=$('drawerDone').onclick=closeDrawer;
$('drawer').addEventListener('click',e=>{if(e.target===$('drawer'))closeDrawer()});
$('drawer').addEventListener('close',()=>{renderItems()});
$('dSearch').oninput=()=>{dui.q=$('dSearch').value;dui.limit=80;renderDrawerList()};
$('dCats').onclick=e=>{const b=e.target.closest('[data-dcat]');if(!b)return;dui.cat=b.dataset.dcat;if(dui.cat!=='Cabinets'&&dui.cat!=='All')dui.type='All';dui.limit=80;renderDrawerChips();renderDrawerList()};
$('dTypes').onclick=e=>{const b=e.target.closest('[data-dtype]');if(!b)return;dui.type=b.dataset.dtype;dui.limit=80;renderDrawerChips();renderDrawerList()};
$('dList').addEventListener('click',e=>{
  const inc=e.target.closest('[data-dinc]'),dec=e.target.closest('[data-ddec]'),more=e.target.closest('[data-more]');
  if(inc){const s=inc.dataset.dinc;if(addItem(s,1))updateDrawerRow(s)}
  else if(dec){const s=dec.dataset.ddec;setQty(s,qtyOf(s)-1,{silent:true});updateDrawerRow(s)}
  else if(more){dui.limit+=80;renderDrawerList()}
});
$('dList').addEventListener('change',e=>{const i=e.target.closest('[data-dqty]');if(!i)return;const s=i.dataset.dqty;setQty(s,i.value===''?0:+i.value,{silent:true});updateDrawerRow(s)});

/* ------------------------------------------------------ compare margins */
$('compare').onclick=()=>{
  const ok=!project().issues.length;
  $('comparison').innerHTML=Array.from({length:50},(_,i)=>{const x=calculateProject(DATA,state,i+1);return '<tr data-cm="'+x.margin+'" class="'+(x.margin===state.margin?'on':'')+'" tabindex="0"><td><b>'+x.margin+'%</b></td><td class="num">'+(ok?money(x.purchase):'—')+'</td><td class="num">'+(ok?money(x.sale):'—')+'</td><td class="num">'+(ok?money(x.profit):'—')+'</td></tr>'}).join('');
  $('compareDlg').showModal();$('comparison').querySelector('.on')?.scrollIntoView({block:'center'});
};
const pickMargin=tr=>{const row=tr?.closest('[data-cm]');if(!row)return;setMargin(+row.dataset.cm);$('compareDlg').close()};
$('comparison').onclick=e=>pickMargin(e.target);
$('comparison').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickMargin(e.target)}};
$('compareClose').onclick=()=>$('compareDlg').close();
$('compareDlg').addEventListener('click',e=>{if(e.target===$('compareDlg'))$('compareDlg').close()});

/* --------------------------------------------------------------- wiring */
$('unitList').addEventListener('focusin',e=>{const c=e.target.closest('[data-unit]');if(c)selectUnit(c.dataset.unit)});
$('unitList').addEventListener('click',e=>{
  const card=e.target.closest('[data-unit]');if(!card)return;
  selectUnit(card.dataset.unit);
  const rep=e.target.closest('[data-urep]'),dup=e.target.closest('[data-udup]'),del=e.target.closest('[data-udel]');
  if(rep){const u=state.units.find(x=>x.id===rep.dataset.uid),cur=whole(u.repeat)?u.repeat:0;setRepeatFor(u.id,Math.max(0,Math.min(MAX,cur+ +rep.dataset.urep)))}
  else if(dup)duplicateUnit(dup.dataset.udup);
  else if(del)deleteUnit(del.dataset.udel);
});
$('unitList').addEventListener('input',e=>{
  const n=e.target.closest('[data-uname]');if(!n)return;
  const u=state.units.find(x=>x.id===n.dataset.uname);u.name=n.value;save();
  if(u.id===active){$('unitName').value=u.name;$('listTitle').textContent='What’s in '+(u.name||'this unit')}
  updateDrawerFooter();
});
$('unitList').addEventListener('change',e=>{
  const n=e.target.closest('[data-uname]'),r=e.target.closest('[data-urepin]');
  if(n){const u=state.units.find(x=>x.id===n.dataset.uname);u.name=u.name.trim()||'Unnamed unit';n.value=u.name;save();if(u.id===active)$('unitName').value=u.name;refreshUnit()}
  else if(r){const v=r.value===''?0:+r.value;setRepeatFor(r.dataset.urepin,whole(v)?v:1)}
});
$('unitList').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input'))e.target.blur()});
$('addUnit').onclick=()=>{const u=freshUnit(String(state.units.length+1).padStart(2,'0'));state.units.push(u);active=u.id;save();loadUnit();if(matchMedia('(min-width:901px)').matches)$('unitName').select();toast('New unit added. Name it, then add cabinets.')};
$('dupUnit').onclick=()=>duplicateUnit(active);
$('delUnit').onclick=()=>deleteUnit(active);
$('unitName').oninput=()=>{unit().name=$('unitName').value;save();const c=document.querySelector('.unitCard[data-unit="'+active+'"] .uName');if(c)c.value=unit().name;$('listTitle').textContent='What’s in '+(unit().name||'this unit')};
$('unitName').onchange=()=>{unit().name=$('unitName').value.trim()||'Unnamed unit';$('unitName').value=unit().name;save();refreshUnit()};
$('repeat').oninput=()=>setRepeatFor(active,$('repeat').value===''?-1:+$('repeat').value);
$('repeat').onchange=()=>{if(!whole(unit().repeat))setRepeatFor(active,1)};
document.querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>{const cur=whole(unit().repeat)?unit().repeat:0;setRepeatFor(active,Math.max(0,Math.min(MAX,cur+ +b.dataset.rep)))});
$('autoToe').onchange=()=>{unit().auto=$('autoToe').checked;save();refreshUnit();updateDrawer()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;try{localStorage.setItem('vulpine-view',view)}catch{}renderItems();updateDrawerFooter()});

$('items').addEventListener('click',e=>{
  const apply=e.target.closest('[data-apply-replacement]');
  if(apply){apply.closest('label').querySelector('input').dispatchEvent(new Event('change',{bubbles:true}));return;}
  const inc=e.target.closest('[data-inc]'),dec=e.target.closest('[data-dec]');
  if(inc){const li=+inc.closest('[data-li]').dataset.li;setQty(inc.dataset.inc,qtyOf(inc.dataset.inc,li)+1,{li});}
  else if(dec){const li=+dec.closest('[data-li]').dataset.li;setQty(dec.dataset.dec,qtyOf(dec.dataset.dec,li)-1,{li});}
  else if(e.target.closest('[data-open-browse]'))openDrawer();
});
$('items').addEventListener('change',e=>{
  const replacement=e.target.closest('[data-replace]');
  if(replacement){
    const li=+replacement.closest('[data-li]').dataset.li,sku=replacement.value.trim();
    if(cost(DATA,li,sku)===null){toast('Choose an exact SKU priced in this supplier and finish.',{error:true});return;}
    const u=unit(),old=u.items.find(x=>x.sku===replacement.dataset.replace&&x.li===li);
    if(!old)return;
    const existing=u.items.find(x=>x!==old&&x.sku===sku&&x.li===li);
    if(existing&&existing.qty+old.qty>MAX){toast('Combined quantity exceeds 100,000.',{error:true});return;}
    if(existing){existing.qty+=old.qty;u.items.splice(u.items.indexOf(old),1);}else old.sku=sku;
    save();refreshUnit();return;
  }
  const row=e.target.closest('[data-li]');if(!row)return;const li=+row.dataset.li;
  const finish=e.target.closest('[data-item-finish]');
  if(finish){const it=unit().items.find(x=>x.sku===finish.dataset.itemFinish&&x.li===li),next=+finish.value;
    if(cost(DATA,next,it.sku)===null){toast('This SKU has no price in that finish.',{error:true});renderItems();return;}
    const other=unit().items.find(x=>x!==it&&x.sku===it.sku&&x.li===next);
    if(other){toast('This SKU already has that finish. Adjust its quantity instead.',{error:true});renderItems();return;}
    it.li=next;it.finishOverride=next!==unit().defaultLi;save();refreshUnit();return;
  }
  const i=e.target.closest('[data-qty]');if(i)setQty(i.dataset.qty,i.value===''?0:+i.value,{li});
});
$('items').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-qty]'))e.target.blur()});
$('fixes').addEventListener('click',e=>{const b=e.target.closest('[data-fix]');if(!b)return;setQty(b.dataset.fix,qtyOf(b.dataset.fix,+b.dataset.li)+ +b.dataset.n,{li:+b.dataset.li})});

$('finish').onchange=()=>changeFinish(+$('finish').value);
for(const key of ['project','status','quoteId','customer','email','preparedBy','notes']){
  $(key).value=state[key];
  $(key).oninput=()=>{state[key]=$(key).value;save();if(step==='quote')renderQuote()};
}
$('mRange').oninput=()=>setMargin(+$('mRange').value);
$('mDown').onclick=()=>setMargin(state.margin-1);$('mUp').onclick=()=>setMargin(state.margin+1);
$('mChips').onclick=e=>{const b=e.target.closest('[data-m]');if(b)setMargin(+b.dataset.m)};
$('mToggle').onclick=()=>{const o=document.querySelector('.bar').classList.toggle('open');$('mToggle').setAttribute('aria-expanded',String(o))};
$('next').onclick=()=>go(step==='build'?'quote':'build');
document.querySelectorAll('.steps [data-step]').forEach(b=>b.onclick=()=>go(b.dataset.step));
$('unitSummary').addEventListener('change',e=>{const i=e.target.closest('[data-srep]');if(!i)return;const v=i.value===''?0:+i.value;setRepeatFor(i.dataset.srep,whole(v)?v:1)});
$('unitSummary').onclick=e=>{const b=e.target.closest('[data-edit-unit]');if(!b)return;active=b.dataset.editUnit;loadUnit();go('build')};
$('comparisonPdf').checked=state.comparison;
$('comparisonPdf').onchange=()=>{state.comparison=$('comparisonPdf').checked;save()};
document.querySelectorAll('[name=documentType]').forEach(r=>r.onchange=()=>{documentType=r.value;invalidatePdf();renderQuote();toast(r.value==='internal'?'Heads up: the internal PDF shows your cost and profit.':'PDF type updated.')});

/* ------------------------------------------------------------- PDF output */
async function generateDocument(print=false){
  refreshDates();renderQuote();if($('generate').disabled)return;
  const snapshot=structuredClone(state),serialized=JSON.stringify(state),type=documentType;if(!snapshot.project.trim())snapshot.project='Untitled project';
  const printWindow=print?window.open('about:blank','_blank'):null;if(printWindow)printWindow.opener=null;
  const button=$('generate');button.disabled=$('printGenerate').disabled=true;button.textContent='Making your PDF…';
  try{
    if(!window.PDFLib)throw Error('The PDF tool is still loading. Try again in a second.');
    const bytes=hosted?await serverExport('pdf',type):await generateQuote(window.PDFLib,DATA,snapshot,type);
    if(JSON.stringify(state)!==serialized||documentType!==type)throw Error('The quote changed while the PDF was being made. Generate it again.');
    invalidatePdf();
    pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const filename=(state.quoteId+'_'+snapshot.project+'_'+documentType).replace(/[^a-z0-9_-]/gi,'_')+'.pdf';
    $('downloadAgain').href=pdfUrl;$('downloadAgain').download=filename;$('downloadResult').hidden=false;
    $('downloadMessage').textContent=filename+' is ready. Attach this file to your email.';
    const params=new URLSearchParams({view:'cm',fs:'1',to:state.email,su:state.quoteId+' - '+snapshot.project,body:'Please find the attached '+(documentType==='customer'?'cabinet quote':documentType==='purchase'?'purchase schedule':'internal costing')+' for '+snapshot.project+'.\n\nReference: '+state.quoteId+'\nQuantity status: '+state.status+'\n\n[Attach '+filename+' before sending.]'});
    $('gmail').href='https://mail.google.com/mail/?'+params;
    if(printWindow){printWindow.location.href=pdfUrl;toast('PDF opened. Use the viewer’s print button.')}
    else{$('downloadAgain').click();toast('PDF made. Attach it in Gmail to send.')}
  }catch(error){
    if(printWindow)printWindow.close();
    toast(error.message||'The PDF could not be made.',{error:true});
  }finally{button.textContent='Generate & download PDF';renderQuote()}
}
$('generate').onclick=()=>generateDocument(false);
$('printGenerate').onclick=()=>generateDocument(true);

/* ------------------------------------------------------------------ start */
function markDeleted(kind,id){
 if(kind==='quote'?historyRef?.id!==id:agentJob?.id!==id)return;
 clearTimeout(saveTimer);projectArchived=recordDeleted=true;historyRef=null;agentJob=null;
 document.querySelectorAll('.app,.bar,.bidAssistant').forEach(el=>el.inert=true);
 $('saveState').textContent='Bid deleted — start a new quote';
 invalidatePdf();
}
async function flushWorkspace(){if(projectArchived||recordDeleted)return;save();await new Promise(r=>setTimeout(r,450));await saveQueue;if(serverConflict||$('saveState').textContent==='Not saved')throw Error('Changes could not be saved. Reload before continuing.');}
async function startQuote(name=projectArchived?'Untitled project':state.project){
 await flushWorkspace();
 const fresh={...newQuote(),project:name||'Untitled project'};
 if(hosted){
  let expected=revision;if(agentJob){const r=await fetch('./draft');if(!r.ok)throw Error('Could not load workspace.');expected=(await r.json()).revision;}
  const r=await fetch('./draft',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({draft:fresh,revision:expected})});
  if(!r.ok)throw Error((await r.json()).error||'Could not start quote.');
 }else localStorage.setItem(KEY,JSON.stringify(fresh));
 location.assign('./index.html');
}
$('clearBoard').onclick=()=>startQuote().catch(e=>toast(e.message,{error:true}));
document.querySelectorAll('.app,.bar').forEach(el=>el.inert=projectArchived);
if(hosted)mountWorkspace({flush:flushWorkspace,startQuote,getReference:()=>historyRef,onDelete:markDeleted,onArchive:archived=>{if(recordDeleted)return;projectArchived=archived;document.querySelectorAll('.app,.bar').forEach(el=>el.inert=archived);},onError:e=>toast(e.message,{error:true})});
$('supplier').onchange=async()=>{
 if(agentJob){$('supplier').value=state.supplier;toast('Create a separate bid for another supplier.');return;}
 const next=$('supplier').value,previous=state.supplier||'hci';if(next===previous)return;
 $('supplier').disabled=true;
 try{
  const catalog=await supplierCatalog(next);supplierDrafts[previous]=structuredClone(state);
  const nextLines=linesFor(catalog);
  state=switchSupplier(state,DATA,catalog,next,supplierDrafts[next]);
  DATA=catalog;LINES=nextLines;IMAGES=next==='hci'?HCI_IMAGES:{};
  for(const key of Object.keys(rowCache))delete rowCache[key];
  for(const key of ['project','status','quoteId','customer','email','preparedBy','notes'])$(key).value=state[key];
  active=state.units[0].id;fillProposalFields();save();renderFinish();loadUnit();renderBar();renderQuote();
  toast('Units and SKUs carried over. Prices use this supplier only. Review finishes and flagged items.');
 }catch(error){$('supplier').value=previous;toast(error.message,{error:true});}finally{$('supplier').disabled=false;}
};
taxUI=mountTax({getState:()=>state,getCalculation:()=>project(),save,refresh:()=>{renderBar();if(step==='quote')renderQuote()},hosted,money});
renderFinish();refreshDates();loadUnit();renderBar();
if(hosted){
 if(agentJob){$('supplier').disabled=true;const notice=document.createElement('p');notice.className='hint';notice.textContent='Saved agent draft. Review quantities and source evidence before customer submission.';document.querySelector('.projectBar').after(notice);}
 mountBidAssistant({currentJob:agentJob,onDelete:markDeleted,flush:async()=>{await new Promise(r=>setTimeout(r,450));await saveQueue;if(serverConflict||$('saveState').textContent==='Not saved')throw Error('Save your current changes before running the assistant.');}});
}
if(storageWarning)toast('Your saved draft couldn’t be loaded, so a fresh project is open.',{error:true});

$('unitSummary').addEventListener('change',event=>{const id=event.target.dataset.unitKind;if(!id)return;const u=state.units.find(u=>u.id===id);u.kind=event.target.value;u.areaId=u.areaId||u.id;save();renderQuote();});
function fillProposalFields(){const p=state.projectInfo||{},n=state.customerSections||{};for(const [id,key]of [['actualApartments','apartments'],['cabinetLine','cabinetLine'],['construction','construction'],['mixEvidence','mixEvidence'],['finishBasis','finishBasis'],['addressEvidence','addressEvidence']])$(id).value=p[key]??'';for(const [id,key]of [['includedScope','included'],['pricingBasis','basis'],['substitutions','substitutions'],['exclusions','exclusions']])$(id).value=n[key]||'';}
for(const [id,key]of [['actualApartments','apartments'],['cabinetLine','cabinetLine'],['construction','construction'],['mixEvidence','mixEvidence'],['finishBasis','finishBasis'],['addressEvidence','addressEvidence']])$(id).addEventListener('input',()=>{state.projectInfo??={};state.projectInfo[key]=id==='actualApartments'?Number($(id).value):$(id).value;save();renderQuote();});
for(const [id,key]of [['includedScope','included'],['pricingBasis','basis'],['substitutions','substitutions'],['exclusions','exclusions']])$(id).addEventListener('input',()=>{state.customerSections??={};state.customerSections[key]=$(id).value;save();renderQuote();});
$('reviseQuote').onclick=async()=>{try{await flushWorkspace();if(!historyRef)throw Error('Save this quote in Back Office before revising.');const r=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'revise-quote',quote_id:historyRef.id,expected_revision:historyRef.revision})});const value=await r.json();if(!r.ok)throw Error(value.error);location.assign('./index.html?quote='+value.state._history.id);}catch(e){toast(e.message,{error:true});}};
fillProposalFields();
