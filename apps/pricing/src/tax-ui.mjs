import {US_STATES,normalizeAddress,validAddress,taxSummary} from './tax.mjs';
export function mountTax({getState,save,refresh,hosted,money}) {
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 $('taxState').innerHTML='<option value="">Choose state</option>'+Object.entries(US_STATES).map(([code,name])=>'<option value="'+code+'">'+name+'</option>').join('');
 let sequence=0,timer,busy=false,message='';
 const current=()=>getState().tax??={enabled:false,address:{street:'',city:'',state:'',zip:''},lookup:null};
 function draw(subtotal=0){
  const t=current(),r=taxSummary(t,subtotal);$('taxEnabled').checked=t.enabled;$('taxFields').hidden=!t.enabled;
  for(const k of ['street','city','state','zip']){const el=$('tax'+k[0].toUpperCase()+k.slice(1));if(document.activeElement!==el)el.value=t.address?.[k]||'';}
  $('taxLookup').disabled=busy||!validAddress(t.address);
  $('taxLookup').textContent=busy?'Looking up…':'Refresh tax';
  $('taxMessage').textContent=message||(!t.enabled?'Sales tax is off.':r.issue?'Enter the project delivery address. Tax updates automatically when all address fields are complete.':'Rates from '+t.lookup.provider+' · '+new Date(t.lookup.retrievedAt).toLocaleString());
  $('taxBreakdown').innerHTML=r.issue||!t.enabled?'':r.components.map(c=>'<div><span>'+esc(c.name)+'</span><strong>'+(c.rate*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%</strong></div>').join('')+'<div class="taxCombined"><span>Combined rate</span><strong>'+(r.rate*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%</strong></div>';
  $('taxAmount').textContent=t.enabled?(r.amount===null?'Pending':money(r.amount)):'Off';
  $('taxTotal').textContent=r.total===null?'Tax pending':money(r.total);
 }
 async function lookup(){
  clearTimeout(timer);const t=current();if(!t.enabled||!validAddress(t.address))return;
  const request=++sequence;busy=true;message='Looking up the delivery address…';refresh();
  try{
   if(!hosted)throw Error('Automatic tax lookup is available in the signed-in Back Office app.');
   const response=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'tax-rate',address:normalizeAddress(t.address)})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Tax lookup failed.');
   if(request!==sequence)return;
   current().lookup=result;message='';save();
  }catch(e){if(request!==sequence)return;current().lookup=null;message=e.message;save();}
  finally{if(request===sequence){busy=false;refresh();}}
 }
 for(const k of ['street','city','state','zip'])$('tax'+k[0].toUpperCase()+k.slice(1)).addEventListener('input',()=>{
  sequence++;busy=false;clearTimeout(timer);const t=current();t.address??={};t.address[k]=$('tax'+k[0].toUpperCase()+k.slice(1)).value;t.lookup=null;message='';save();refresh();
  if(validAddress(t.address))timer=setTimeout(lookup,750);
 });
 $('taxEnabled').onchange=()=>{sequence++;busy=false;clearTimeout(timer);current().enabled=$('taxEnabled').checked;message='';save();refresh();if(current().enabled&&validAddress(current().address))lookup();};
 $('taxLookup').onclick=lookup;
 return {draw};
}
