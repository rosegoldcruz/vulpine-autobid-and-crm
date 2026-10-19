import {linesFor,lookup} from './pricing.mjs';
import {addressKey} from './tax.mjs';
export const HANDLE_RATE=333, FREIGHT_RATE=13300;
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
export const freightItem=row=>/delivery|freight|feight|shipping/i.test(row.sku+' '+row.description);
export const handleItem=row=>/\b(handle|pull|knob)s?\b/i.test(row.description)&&!row.boxes;
export function quantities(data,state,units){
 const areas=new Map(),apartmentGroups=new Map(),issues=[];
 for(const u of units.filter(u=>u.repeat>0)){
  const key=u.areaId||u.id, target=u.kind==='amenity'?areas:apartmentGroups;
  if(target.has(key)&&target.get(key)!==u.repeat)issues.push('Conflicting counts for '+u.name+'.');
  if(u.kind==='amenity'&&u.areas?.length){for(const area of u.areas)areas.set(area,1);}else target.set(key,u.repeat);
  if(u.kind==='amenity'&&u.repeat!==1)issues.push('Count each named amenity area once: '+u.name+'.');
 }
 const apartments=[...apartmentGroups.values()].reduce((a,b)=>a+b,0),amenities=areas.size;
 const expected=state.projectInfo?.apartments;
 if(!nonnegative(expected)||expected===0)issues.push('Enter the actual apartment count from the project inventory.');
 else if(apartments!==expected)issues.push('Scheduled apartments ('+apartments+') do not match the actual project count ('+expected+'). A sample schedule is not a complete project price.');
 if(!state.projectInfo?.mixEvidence?.trim())issues.push('Record the source and reconciliation for the actual project unit mix.');
 return {apartments,actualApartments:nonnegative(expected)&&expected>0?expected:null,amenities,groups:apartmentGroups.size,shippingUnits:(nonnegative(expected)&&expected>0?expected:apartments)+amenities,issues};
}
export function projectCharges(data,state,units){
 const counts=quantities(data,state,units),issues=[...counts.issues];let boxes=0,accessories=0,handles=0,includedHandles=0,listedHandles=0,freightCost=0;
 const assemblies=new Set();
 for(const u of units.filter(u=>u.repeat>0))for(const r of u.entries){
  const meta=lookup(data,r.li,r.sku),extended=r.qty*u.repeat;
  if(freightItem(r)){freightCost+=r.purchase*extended;continue;}
  if(handleItem(r)){listedHandles+=extended;continue;}
  if(data.countsVerified===false&&meta?.[5]===0&&/cabinet|base|vanity|wall/i.test(r.description))issues.push('Verify cabinet-box and handle quantities for '+u.name+' / '+r.sku+'.');
  if(!meta?.[5]){accessories+=extended;continue;}
  const key=(u.areaId||u.id)+':'+(r.assemblyId||r.li+':'+r.sku);
  if(r.assemblyId&&assemblies.has(key)){issues.push('Duplicate cabinet assembly across finishes: '+r.assemblyId+'. Charge each physical cabinet once.');continue;}
  assemblies.add(key);boxes+=meta[5]*extended;
  const configuration=r.handleCount??(data.countsVerified===false?null:meta[7]);
  if(!nonnegative(configuration)||configuration===0){issues.push('Verify door/drawer handle configuration for '+u.name+' / '+r.sku+'.');continue;}
  const quantity=configuration*extended;handles+=quantity;
  if(r.handlesIncluded){if(!r.handleInclusion?.trim())issues.push('Name the line that already includes handles for '+r.sku+'.');includedHandles+=quantity;}
 }
 const remaining=Math.max(0,handles-includedHandles-listedHandles),freight=state.charges?.freight;
 if(freight?.override&&!freight.approval?.trim())issues.push('A project freight override requires an explicit approval reference.');
 const rate=freight?.override&&freight.approval?.trim()?freight.rate:FREIGHT_RATE;
 if(listedHandles>handles)issues.push('Listed decorative handles exceed the configured handle quantity.');
 if(!nonnegative(rate))issues.push('Freight selling rate must be a nonnegative amount in cents.');
 for(const amount of [state.charges?.handles?.supplierCost,freight?.supplierCost])if(amount!==undefined&&amount!==null&&!nonnegative(amount))issues.push('Supplier costs must be nonnegative integer amounts in cents.');
 const handlesAmount=remaining*HANDLE_RATE,shippingAmount=counts.shippingUnits*(nonnegative(rate)?rate:0);if(!Number.isSafeInteger(handlesAmount)||!Number.isSafeInteger(shippingAmount))issues.push('Project charges exceed the supported currency range.');
 return {counts,boxes,accessories,handles:{quantity:handles,chargedQuantity:remaining,includedQuantity:includedHandles+listedHandles,rate:HANDLE_RATE,amount:handlesAmount,supplierCost:state.charges?.handles?.supplierCost??null},freight:{quantity:counts.shippingUnits,rate,amount:shippingAmount,supplierCost:freight?.supplierCost??(freightCost||null),approval:freight?.approval||''},installation:state.charges?.installation??{status:'excluded',amount:0},assembly:state.charges?.assembly??{status:'excluded',amount:0},issues};
}
export function customerIssues(data,state,result){
 const errors=[...result.issues,...(result.charges?.issues||[])];
 if(result.tax.issue)errors.push(result.tax.issue);
 if(!state.project?.trim())errors.push('Project name is required.');
 if(!state.customer?.trim())errors.push('General contractor/customer company is required.');
 if(state.pricingPolicy!==2)errors.push('Create a revised draft using current handles, freight and project-count rules. Historical quotes are preserved.');
 const selected=state.units.filter(u=>u.repeat>0).flatMap(u=>u.items.filter(i=>i.qty>0));
 if(!state.projectInfo?.cabinetLine?.trim())errors.push('Cabinet line is required.');
 if(!selected.length||selected.some(i=>!linesFor(data)[i.li]))errors.push('Select a verified cabinet finish for every item.');
 if(!state.projectInfo?.finishBasis?.trim())errors.push('Record the specified finish/location mapping or disclosed preliminary White Shaker basis.');
 if(state.projectInfo?.construction==='frameless'&&selected.some(i=>!String(data.families?.[i.li]||linesFor(data)[i.li]?.[1]).match(/frameless|euro/i)))errors.push('Frameless construction is required; framed cabinetry cannot be substituted.');
 if(state.projectInfo?.finishUnresolved)errors.push('Specified finish/location mapping remains unresolved; customer-ready export is blocked.');
 if(state.projectInfo?.scopeIncomplete)errors.push('The project scope is incomplete; this is an internal priced-scope draft.');
 if(state.projectInfo?.conflicts?.length)errors.push(...state.projectInfo.conflicts.filter(s=>!/\b(delivery address|delivery title blocks|ship-to|shipping address)\b/i.test(s)).map(s=>'Source conflict: '+s));
 if(!state.tax?.enabled&&!state.tax?.exemption)errors.push('Verified sales tax or a documented applicable exemption is required.');
 if(state.tax?.enabled&&!state.tax.lookup?.taxableItems)errors.push('Verify which line items are taxable, including handles and freight.');
 if(state.tax?.enabled&&state.tax.lookup?.addressKey!==addressKey(state.tax.address))errors.push('Tax must match the verified delivery address.');
 return [...new Set(errors)];
}
export function customerNotes(state){
 const s=state.customerSections||{};
 return {'Included Scope':s.included||'Cabinet boxes and listed trim/panels; decorative handles and project delivery are priced in the summary.', 'Pricing Basis':s.basis||state.projectInfo?.finishBasis||'Finish and project mix require verification.',Substitutions:s.substitutions||'No product substitution is approved.',Exclusions:s.exclusions||'Installation and assembly excluded. Countertops, appliances and plumbing fixtures excluded.'};
}
