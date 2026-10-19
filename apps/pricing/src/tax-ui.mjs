import {US_STATES,normalizeAddress,validAddress,taxSummary} from './tax.mjs';
export function mountTax({getState,getCalculation,save,refresh,hosted,money}) {
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 $('taxState').innerHTML='<option value="">Choose state</option>'+Object.entries(US_STATES).map(([code,name])=>'<option value="'+code+'">'+name+'</option>').join('');
 let sequence=0,timer,busy=false,message='',manualDirty=false;
 const current=()=>{const t=getState().tax??={enabled:true,address:{street:'',city:'',state:'',zip:''},lookup:null};t.mode??=t.lookup?.manual?'manual':'automatic';return t;};
 function draw(subtotal=0){
  const t=current(),manual=(t.mode||(t.lookup?.manual?'manual':'automatic'))==='manual',calculation=getCalculation?.(),r=calculation?.tax||taxSummary(t,subtotal);$('taxEnabled').checked=t.enabled;$('taxFields').hidden=false;
  $('taxMode').value=manual?'manual':'automatic';$('manualTaxFields').hidden=!manual;$('taxLookup').hidden=manual;
  $('applyManualTax').disabled=busy;
  if(t.lookup?.manual&&!manualDirty)$('manualTaxRate').value=String(Number((t.lookup.rate*100).toFixed(8)));
  for(const k of ['street','city','state','zip']){const el=$('tax'+k[0].toUpperCase()+k.slice(1));if(document.activeElement!==el)el.value=t.address?.[k]||'';}
  $('taxLookup').disabled=busy||!validAddress(t.address);
  $('taxLookup').textContent=busy?'Looking up…':'Refresh tax';
  $('taxMessage').textContent=message||(!t.enabled?t.exemption?'Documented exemption: '+t.exemption.reason:'No tax is applied. Select automatic lookup or enter a manual rate.':r.issue?manual?'Enter a tax rate; it applies automatically.':'Enter the project delivery address for automatic tax, or choose Manual rate (%).':t.lookup.manual?'Manual entry · '+new Date(t.lookup.retrievedAt).toLocaleString():'Rates from '+t.lookup.provider+' · '+new Date(t.lookup.retrievedAt).toLocaleString());
  $('taxBreakdown').innerHTML=r.issue||!t.enabled?'':r.components.map(c=>'<div><span>'+esc(c.name)+'</span><strong>'+(c.rate*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%</strong></div>').join('')+'<div class="taxCombined"><span>Combined rate</span><strong>'+(r.rate*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%</strong></div>';
  $('taxAmount').textContent=t.enabled?(r.amount===null?'Pending':money(r.amount)):t.exemption?'Exempt':'Required';
  $('taxTotal').textContent=r.total===null?'Tax pending':money(r.total);
 }
 async function lookup(){
  clearTimeout(timer);const t=current();if(t.mode==='manual'||!t.enabled||!validAddress(t.address))return;
  const request=++sequence;busy=true;message='Looking up the delivery address…';refresh();
  try{
   if(!hosted)throw Error('Automatic tax lookup is available in the signed-in Back Office app.');
   const response=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'tax-rate',address:normalizeAddress(t.address),state:getState()})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Tax lookup failed.');
   if(request!==sequence)return;
   current().lookup=result;delete current().exemption;message='';save();
  }catch(e){if(request!==sequence)return;current().lookup=null;message=e.message+' Choose Manual rate (%) to enter the rate yourself.';save();}
  finally{if(request===sequence){busy=false;refresh();}}
 }
 for(const k of ['street','city','state','zip'])$('tax'+k[0].toUpperCase()+k.slice(1)).addEventListener('input',()=>{
  sequence++;busy=false;clearTimeout(timer);const t=current();t.address??={};t.address[k]=$('tax'+k[0].toUpperCase()+k.slice(1)).value;t.lookup=null;message='';save();refresh();
  if(t.mode!=='manual'&&validAddress(t.address))timer=setTimeout(lookup,750);
 });
 $('taxEnabled').onchange=()=>{sequence++;busy=false;clearTimeout(timer);current().enabled=$('taxEnabled').checked;message='';save();refresh();if(current().mode!=='manual'&&current().enabled&&validAddress(current().address))lookup();};
 $('taxMode').onchange=()=>{sequence++;busy=false;clearTimeout(timer);const t=current();t.mode=$('taxMode').value;t.lookup=null;delete t.exemption;t.enabled=true;manualDirty=true;message='';save();refresh();if(t.mode==='automatic'&&validAddress(t.address))lookup();};
 $('manualTaxRate').oninput=()=>{sequence++;busy=false;clearTimeout(timer);manualDirty=true;const raw=$('manualTaxRate').value.trim(),rate=Number(raw);if(raw!==''&&Number.isFinite(rate)&&rate>=0&&rate<=100)timer=setTimeout(()=>$('applyManualTax').onclick(),500);};
 $('applyManualTax').onclick=async()=>{
  const raw=$('manualTaxRate').value.trim(),ratePercent=Number(raw);
  if(raw===''||!Number.isFinite(ratePercent)||ratePercent<0||ratePercent>100){message='Enter a tax rate from 0 to 100 percent, such as 6.75.';refresh();return;}
  const request=++sequence;clearTimeout(timer);busy=true;message='Applying manual tax…';refresh();
  try{
   if(!hosted)throw Error('Save manual tax in the signed-in Back Office app.');
   const response=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'manual-tax',ratePercent,address:current().address})});
   const value=await response.json();if(!response.ok)throw Error(value.error||'Manual tax could not be saved.');if(request!==sequence)return;
   const t=current();t.enabled=true;t.mode='manual';t.lookup=value;delete t.exemption;manualDirty=false;message='Manual tax applied.';save();
  }catch(e){if(request===sequence)message=e.message;}
  finally{if(request===sequence){busy=false;refresh();}}
 };
 $('taxLookup').onclick=lookup;
 $('verifyExemption').onclick=async()=>{try{const r=await fetch('./export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:'tax-exemption',address:current().address,reason:$('exemptionReason').value,authority:$('exemptionAuthority').value,document:$('exemptionDocument').value,validFrom:$('exemptionFrom').value,validUntil:$('exemptionUntil').value})});const value=await r.json();if(!r.ok)throw Error(value.error);current().exemption=value;current().enabled=false;current().lookup=null;message='Applicable exemption documented.';save();refresh();}catch(e){message=e.message;refresh();}};
 return {draw};
}
