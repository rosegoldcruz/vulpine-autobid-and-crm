import {taxSummary} from './tax.mjs';
export const LINES=[['White Shaker','Shaker',2],['Grey Shaker','Shaker',2],['Dove White Slim Shaker','Shaker',2],['Modern Slate Shaker','Shaker',3],['Onyx Shaker','Shaker',3],['Signature Blue Shaker','Shaker',3],['Saige Green Slim Shaker','Shaker',3],['Mountain Timber Shaker','Shaker',4],['Euro Classic','Euro',2],['Euro Deluxe','Euro',3],['Euro Custom Deluxe','Euro',4]];
export const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export const whole=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
export function quoteDates(now=new Date()){const expiry=new Date(now);expiry.setDate(expiry.getDate()+45);const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return{date:iso(now),validUntil:iso(expiry)}}
export const linesFor=data=>data.lines||LINES;
export const lookup=(data,li,sku)=>data[linesFor(data)[li]?.[1]]?.find(r=>r[0]===sku);
export function cost(data,li,sku){const r=lookup(data,li,sku),l=linesFor(data)[li];if(!r||!l||!data.supplier&&l[0].includes('Slim')&&/glass/i.test(r[1]))return null;return typeof r[l[2]]==='number'?Math.round(r[l[2]]*100):null}
export function sell(c,m){if(!Number.isInteger(m)||m<1||m>50)throw Error('Margin must be 1% to 50%.');return Math.round(c*100/(100-m))}
export function calculateUnit(data,unit,margin){
 const LINES=linesFor(data);
 let issues=[],entries=unit.items.filter(x=>x.qty!==0).map(x=>({...x}));
 if(!whole(unit.repeat))issues.push('Repeat count must be a whole number from 0 to 100,000.');
 for(const x of entries){if(!whole(x.qty))issues.push(x.sku+': quantity must be a whole number from 0 to 100,000.');if(cost(data,x.li,x.sku)===null)issues.push(x.sku+': price unavailable.');}
 if(unit.auto&&data.autoToe!==false){entries=entries.filter(x=>x.sku!=='TK8');for(let li=0;li<LINES.length;li++){const width=entries.filter(x=>x.li===li&&whole(x.qty)).reduce((s,x)=>s+(lookup(data,li,x.sku)?.[6]||0)*x.qty,0);if(width>0)entries.push({li,sku:'TK8',qty:Math.ceil(width/96),auto:true})}}
 for(const x of entries){const r=lookup(data,x.li,x.sku);if(!r)continue;
  const needed=entries.filter(y=>y.li===x.li&&y.sku===x.sku).reduce((s,y)=>s+y.qty,0);
  if(r[8]&&entries.filter(y=>y.li===x.li&&y.sku===r[8]).reduce((s,y)=>s+y.qty,0)<needed)issues.push(x.sku+': add '+needed+' × '+r[8]+' in this unit.');
  if(LINES[x.li][1]==='Shaker'&&/^(PC|OC)/.test(x.sku)&&!/(BOX|FFD)$/.test(x.sku)&&entries.some(y=>y.li===x.li&&(y.sku===x.sku+'BOX'||y.sku===x.sku+'FFD')))issues.push(x.sku+': complete cabinet and component overlap.');
 }
 entries=entries.map(x=>{const r=lookup(data,x.li,x.sku),purchase=cost(data,x.li,x.sku),sale=purchase===null?null:sell(purchase,margin);return{...x,description:r?.[1]||'Unknown item',line:LINES[x.li]?.[0]||'Unknown finish',purchase,sale,source:r?.[10]||'',basis:r?.[11]||''}});
 const purchase=entries.reduce((s,x)=>s+(x.purchase||0)*(whole(x.qty)?x.qty:0),0),sale=entries.reduce((s,x)=>s+(x.sale||0)*(whole(x.qty)?x.qty:0),0);
 if(!Number.isSafeInteger(purchase*unit.repeat)||!Number.isSafeInteger(sale*unit.repeat))issues.push('Project amount exceeds the supported range.');
 return{...unit,entries,issues:[...new Set(issues)],purchase,sale,profit:sale-purchase};
}
export function calculateProject(data,state,margin=state.margin){
 const units=state.units.map(u=>calculateUnit(data,u,margin)),active=units.filter(u=>u.repeat!==0);
 const issues=active.flatMap(u=>u.issues.map(s=>u.name+': '+s));
 for(const u of active)if(!u.entries.length)issues.push(u.name+': add items or set repeat count to 0.');
 if(!active.length)issues.push('Include at least one unit with a positive repeat count.');
 const purchase=active.reduce((s,u)=>s+u.purchase*(whole(u.repeat)?u.repeat:0),0),sale=active.reduce((s,u)=>s+u.sale*(whole(u.repeat)?u.repeat:0),0);
 if(!Number.isSafeInteger(purchase)||!Number.isSafeInteger(sale))issues.push('Project amount exceeds the supported range.');
 const tax=taxSummary(state.tax,sale);if(tax.issue)issues.push(tax.issue);
 if(tax.total!==null&&!Number.isSafeInteger(tax.total))issues.push('Tax-inclusive total exceeds the supported range.');
 return{units,issues,purchase,sale,tax,total:tax.total,profit:sale-purchase,count:active.reduce((s,u)=>s+(whole(u.repeat)?u.repeat:0),0),margin,actualMargin:sale?(sale-purchase)/sale*100:0};
}
