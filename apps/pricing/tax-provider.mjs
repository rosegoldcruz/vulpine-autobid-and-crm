import {createHmac,timingSafeEqual} from 'node:crypto';
import {normalizeAddress,validAddress,addressKey,taxSummary} from './src/tax.mjs';
export function taxProvider(env) {return env.TAXJAR_API_TOKEN?'TaxJar':env.AVALARA_ACCOUNT_ID&&env.AVALARA_LICENSE_KEY?'Avalara':null;}
const sign=(lookup,secret)=>createHmac('sha256',secret).update(JSON.stringify(lookup)).digest('hex');
export function verifyTax(tax,env){
 if(!tax?.enabled)return;
 if(taxSummary(tax,0).issue)throw Error('Refresh the project tax lookup before exporting.');
 const {signature,...lookup}=tax.lookup;
 const a=Buffer.from(String(signature||'')),b=Buffer.from(sign(lookup,env.OPS_SIGNING_SECRET));
 if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('Tax lookup could not be verified. Look up the address again.');
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
