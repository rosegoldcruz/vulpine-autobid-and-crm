import {linesFor,calculateUnit} from './pricing.mjs';

// Transfer quantities and literal SKU codes, never prices or guessed SKU aliases.
export function switchSupplier(state,source,target,supplier,previous){
 const lines=linesFor(target),sourceLines=linesFor(source);
 const fallback=Math.max(0,lines.findIndex(l=>l[0]==='Shaker White (RTA)'));
 const finish=li=>{const i=lines.findIndex(l=>l[0]===sourceLines[li]?.[0]);return i<0?fallback:i;};
 return {...structuredClone(state),supplier,units:state.units.map(u=>{
  const old=previous?.units.find(v=>v.id===u.id);
  const defaultLi=lines[old?.defaultLi]?old.defaultLi:finish(u.defaultLi);
  // Materialize automatic trim before moving to a supplier with manual trim.
  const entries=calculateUnit(source,u,state.margin).entries;
  const items=entries.map(it=>{
   const prior=old?.items.find(x=>x.sku===it.sku);
   const li=lines[prior?.li]?prior.li:it.li===u.defaultLi?defaultLi:finish(it.li);
   return {sku:it.sku,qty:it.qty,li,finishOverride:li!==defaultLi};
  });
  // Distinct source finishes can map to one destination finish. Combine only exact SKUs.
  const merged=[];
  for(const it of items){const found=merged.find(x=>x.sku===it.sku&&x.li===it.li);if(found)found.qty+=it.qty;else merged.push(it);}
  return {...structuredClone(u),defaultLi,auto:false,items:merged};
 })};
}
