export const US_STATES = Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(s=>s.split(':')));
export function normalizeAddress(input={}) {
 return Object.fromEntries(['street','city','state','zip'].map(k=>[k,String(input[k]||'').trim().replace(/\s+/g,' ').toUpperCase()]));
}
export const addressKey = address => JSON.stringify(normalizeAddress(address));
export const TAX_ITEMS=['cabinets','handles','freight','installation','assembly'];
export const TAXABLE_SUPPLY_ITEMS=['cabinets','handles'];
export function validAddress(a) { a=normalizeAddress(a);return a.street.length>=3&&a.street.length<=200&&a.city.length>=2&&a.city.length<=100&&!!US_STATES[a.state]&&/^\d{5}(-\d{4})?$/.test(a.zip); }
export function taxSummary(tax,subtotal,now=Date.now(),items=null,date=null) {
 if(tax?.exemption){const e=tax.exemption,valid=validAddress(tax.address)&&e.addressKey===addressKey(tax.address)&&e.reason?.trim()&&e.document?.trim()&&e.authority?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(e.validFrom||'')&&/^\d{4}-\d{2}-\d{2}$/.test(e.validUntil||'')&&e.validFrom<=(date||new Date(now).toISOString().slice(0,10))&&e.validUntil>=(date||new Date(now).toISOString().slice(0,10));return {amount:valid?0:null,total:valid?subtotal:null,rate:valid?0:null,components:[],taxableAmount:valid?0:null,exemption:e,issue:valid?null:'Document the applicable exemption, authority, delivery address and validity dates.'};}
 if(!tax?.enabled&&items)return {amount:null,total:null,rate:null,components:[],issue:'Verified transaction tax or a documented applicable exemption is required.'};
 if(!tax?.enabled)return {amount:0,total:subtotal,rate:0,components:[],issue:null};
 const r=tax.lookup,manual=r?.manual===true&&r.provider==='Manual entry';
 const valid=(manual||validAddress(tax.address))&&r&&r.addressKey===addressKey(tax.address)&&Number.isFinite(r.rate)&&r.rate>=0&&r.rate<=1&&Array.isArray(r.components)&&r.components.length>0&&r.components.every(c=>typeof c.name==='string'&&Number.isFinite(c.rate)&&c.rate>=0&&c.rate<=1)&&Math.abs(r.components.reduce((s,c)=>s+c.rate,0)-r.rate)<0.00001&&Number.isFinite(Date.parse(r.retrievedAt))&&now-Date.parse(r.retrievedAt)>=-60000&&(manual||now-Date.parse(r.retrievedAt)<86400000)&&(!manual||TAX_ITEMS.every(key=>typeof r.taxableItems?.[key]==='boolean'));
 if(!valid)return {amount:null,total:null,rate:null,components:[],issue:'Look up tax for the complete project delivery address before exporting. Rates must be refreshed daily.'};
 if(items&&!manual&&(!r.taxableItems||JSON.stringify(r.lineAmounts)!==JSON.stringify(items)||r.applicableDate!==date))return {amount:null,total:null,rate:null,components:[],issue:'Refresh transaction tax after changing the date, cabinets, handles, freight or services.'};
 if(items&&!manual&&TAX_ITEMS.filter(key=>!TAXABLE_SUPPLY_ITEMS.includes(key)).some(key=>r.taxableItems[key]||r.taxableAmounts?.[key]>0))return {amount:null,total:null,rate:null,components:[],issue:'Refresh tax: only cabinet materials and handles are taxable.'};
 const taxableAmount=items?Object.entries(items).reduce((sum,[key,amount])=>sum+(!TAXABLE_SUPPLY_ITEMS.includes(key)?0:manual?amount:(r.taxableAmounts?.[key]??(r.taxableItems[key]?amount:0))),0):subtotal;
 const amount=!manual&&items&&Number.isSafeInteger(r.taxAmount)?r.taxAmount:Math.round(taxableAmount*r.rate);
 return {amount,taxableAmount,total:subtotal+amount,rate:r.rate,components:r.components,issue:null};
}
