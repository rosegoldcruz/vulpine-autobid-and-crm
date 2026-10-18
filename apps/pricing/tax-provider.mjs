import {createHmac,timingSafeEqual} from 'node:crypto';
import {normalizeAddress,validAddress,addressKey,taxSummary} from './src/tax.mjs';
export function taxProvider(env) {return env.TAXJAR_API_TOKEN?'TaxJar':env.AVALARA_ACCOUNT_ID&&env.AVALARA_LICENSE_KEY?'Avalara':null;}
// JSONB changes object-key order; signatures must survive saving/reopening a quote.
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sign=(lookup,secret)=>createHmac('sha256',secret).update(canonical(lookup)).digest('hex');
export function verifyTax(tax,env){
 if(tax?.exemption){const {signature,...value}=tax.exemption;const expected=sign(value,env.OPS_SIGNING_SECRET);if(typeof signature!=='string'||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected))||taxSummary(tax,0).issue)throw Object.assign(Error('Exemption evidence must be verified in the signed-in app.'),{status:422});return;}
 if(!tax?.enabled)return;
 if(taxSummary(tax,0).issue)throw Object.assign(Error('Refresh the project tax lookup before exporting.'),{status:422});
 const {signature,...lookup}=tax.lookup;
 const a=Buffer.from(String(signature||'')),b=Buffer.from(sign(lookup,env.OPS_SIGNING_SECRET));
 if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(Error('Tax lookup could not be verified. Look up the address again.'),{status:422});
}
export async function lookupTax(input,env,fetcher=fetch) {
 const address=normalizeAddress(input);
 if(!validAddress(address))throw Error('Enter a street address, city, U.S. state and valid ZIP code.');
 const provider=taxProvider(env);
 if(!provider){const e=Error('Automatic U.S. tax lookup needs a connected tax service. No tax rate has been applied.');e.status=503;throw e;}
 let url,headers;
 if(provider==='TaxJar'){
  url=new URL('https://api.taxjar.com/v2/rates/'+address.zip);
  url.search=new URLSearchParams({country:'US',state:address.state,city:address.city,street:address.street}).toString();
  headers={Authorization:'Bearer '+env.TAXJAR_API_TOKEN};
 }else{
  url=new URL('https://rest.avatax.com/api/v2/taxrates/byaddress');
  url.search=new URLSearchParams({country:'US',region:address.state,city:address.city,line1:address.street,postalCode:address.zip}).toString();
  headers={Authorization:'Basic '+Buffer.from(env.AVALARA_ACCOUNT_ID+':'+env.AVALARA_LICENSE_KEY).toString('base64'),'X-Avalara-Client':'Vulpine Cabinet Pricing; 1.0'};
 }
 let response;
 try{response=await fetcher(url,{headers,signal:AbortSignal.timeout(12000)});}catch{throw Error('Tax service did not respond. Try the lookup again.');}
 if(!response.ok)throw Error(response.status===401||response.status===403?'The tax service rejected its credentials. No rate was applied.':'Tax service could not resolve this address. Check the delivery address and try again.');
 const data=await response.json();let rate,components;
 const number=v=>v===null||v===undefined||v===''?NaN:Number(v);
 if(provider==='TaxJar'){
  const r=data.rate||{};rate=number(r.combined_rate);
  if(String(r.state||'').toUpperCase()!==address.state)throw Error('Tax service returned a different state. Check the address.');
  components=[{name:'State — '+r.state,rate:number(r.state_rate)},{name:'County — '+(r.county||'None'),rate:number(r.county_rate)},{name:'City — '+(r.city||address.city),rate:number(r.city_rate)},{name:'Special districts (combined)',rate:number(r.combined_district_rate)}];
 }else{rate=number(data.totalRate);components=(data.rates||[]).map(r=>({name:String(r.name||r.type||'Jurisdiction'),rate:number(r.rate)}));}
 const lookup={provider,addressKey:addressKey(address),rate,components,retrievedAt:new Date().toISOString()};
 if(taxSummary({enabled:true,address,lookup},0).issue)throw Error('Tax service returned incomplete or inconsistent rates. No rate was applied.');
 return {...lookup,signature:sign(lookup,env.OPS_SIGNING_SECRET)};
}

export function verifyExemption(input,env){
 const address=normalizeAddress(input.address),exemption={reason:String(input.reason||'').trim(),document:String(input.document||'').trim(),authority:String(input.authority||'').trim(),validFrom:input.validFrom,validUntil:input.validUntil,addressKey:addressKey(address)};
 const tax={address,exemption};if(taxSummary(tax,0).issue)throw Object.assign(Error(taxSummary(tax,0).issue),{status:422});
 return {...exemption,signature:sign(exemption,env.OPS_SIGNING_SECRET)};
}
export async function lookupTransactionTax(address,items,date,env,fetcher=fetch){
 if(!validAddress(address))throw Error('Enter the verified complete delivery address.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!items||Object.values(items).some(n=>!Number.isSafeInteger(n)||n<0))throw Error('A valid pricing date and line item amounts are required.');
 if(!env.TAXJAR_API_TOKEN)throw Object.assign(Error('Transaction tax requires a configured TaxJar credential. No tax amount has been applied.'),{status:503});
 const a=normalizeAddress(address),names=['cabinets','handles','installation','assembly'];
 const body={to_country:'US',to_zip:a.zip,to_state:a.state,to_city:a.city,to_street:a.street,amount:Object.values(items).reduce((s,n)=>s+n,0)/100,shipping:items.freight/100,transaction_date:date,line_items:names.filter(k=>items[k]>0).map(k=>({id:k,quantity:1,unit_price:items[k]/100}))};
 let response;try{response=await fetcher('https://api.taxjar.com/v2/taxes',{method:'POST',headers:{Authorization:'Bearer '+env.TAXJAR_API_TOKEN,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});}catch{throw Error('Tax provider did not respond. Draft retained; refresh transaction tax.');}
 if(!response.ok)throw Error('Transaction tax provider rejected the calculation (HTTP '+response.status+'). Draft retained.');
 const value=(await response.json()).tax,breakdown=value?.breakdown;
 if(!value||!breakdown||!Number.isFinite(value.rate)||!Number.isFinite(value.amount_to_collect)||typeof value.freight_taxable!=='boolean'||!Array.isArray(breakdown.line_items))throw Error('Tax provider returned an incomplete taxable-item breakdown.');
 const taxableItems={},taxableAmounts={},components=[{name:'Verified transaction combined rate',rate:value.rate}];
 for(const key of names){const line=breakdown.line_items.find(r=>r.id===key);if(items[key]>0&&!Number.isFinite(line?.taxable_amount))throw Error('Tax provider omitted taxable status for '+key+'.');taxableItems[key]=items[key]>0&&line.taxable_amount>0;taxableAmounts[key]=items[key]>0?Math.round(line.taxable_amount*100):0;if(taxableAmounts[key]<0||taxableAmounts[key]>items[key])throw Error('Tax provider returned an invalid taxable amount for '+key+'.');}
 taxableItems.freight=value.freight_taxable;taxableAmounts.freight=value.freight_taxable?Math.round((breakdown.shipping?.taxable_amount??items.freight/100)*100):0;
 const lookup={provider:'TaxJar transaction',addressKey:addressKey(a),rate:value.rate,components,retrievedAt:new Date().toISOString(),applicableDate:date,lineAmounts:items,taxableItems,taxableAmounts,taxAmount:Math.round(value.amount_to_collect*100)};
 const tax={enabled:true,address:a,lookup};if(taxSummary(tax,0,Date.now(),items,date).issue)throw Error('Tax calculation could not be validated.');
 return {...lookup,signature:sign(lookup,env.OPS_SIGNING_SECRET)};
}
