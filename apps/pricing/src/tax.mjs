export const US_STATES = Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(s=>s.split(':')));
export function normalizeAddress(input={}) {
 return Object.fromEntries(['street','city','state','zip'].map(k=>[k,String(input[k]||'').trim().replace(/\s+/g,' ').toUpperCase()]));
}
export const addressKey = address => JSON.stringify(normalizeAddress(address));
export function validAddress(a) { a=normalizeAddress(a);return a.street.length>=3&&a.street.length<=200&&a.city.length>=2&&a.city.length<=100&&!!US_STATES[a.state]&&/^\d{5}(-\d{4})?$/.test(a.zip); }
export function taxSummary(tax,subtotal,now=Date.now()) {
 if(!tax?.enabled)return {amount:0,total:subtotal,rate:0,components:[],issue:null};
 const r=tax.lookup;
 const valid=validAddress(tax.address)&&r&&r.addressKey===addressKey(tax.address)&&Number.isFinite(r.rate)&&r.rate>=0&&r.rate<=1&&Array.isArray(r.components)&&r.components.length>0&&r.components.every(c=>typeof c.name==='string'&&Number.isFinite(c.rate)&&c.rate>=0&&c.rate<=1)&&Math.abs(r.components.reduce((s,c)=>s+c.rate,0)-r.rate)<0.00001&&Number.isFinite(Date.parse(r.retrievedAt))&&now-Date.parse(r.retrievedAt)>=-60000&&now-Date.parse(r.retrievedAt)<86400000;
 if(!valid)return {amount:null,total:null,rate:null,components:[],issue:'Look up tax for the complete project delivery address before exporting. Rates must be refreshed daily.'};
 const amount=Math.round(subtotal*r.rate);
 return {amount,total:subtotal+amount,rate:r.rate,components:r.components,issue:null};
}
