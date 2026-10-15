// One-time, additive migration. Never writes or removes existing workspace files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createBiddingServer} from './server.mjs';
import {quoteDates} from '../src/pricing.mjs';
if(process.argv[2]!=='--run')throw Error('Pass --run to import existing workspaces.');
const hash=s=>createHash('sha256').update(s).digest('hex');
const app=await createBiddingServer(process.env,{worker:false});let imported=0,skipped=0;
try{
 const org=process.env.OPS_ORGANIZATION_ID,folder=path.join('/var/lib/private/vulpine-cabinet-pricing',hash(org));
 for(const file of await fs.readdir(folder)){
  if(!file.endsWith('.json'))continue;
  const raw=await fs.readFile(path.join(folder,file),'utf8'),saved=JSON.parse(raw);if(!saved.updatedBy||!saved.draft)continue;
  const actor={sub:saved.updatedBy,org,scopes:['bids.read','bids.write']},existing=await app.store.list(actor);
  const candidates={...(saved.draft.supplierDrafts||{}),[saved.draft.supplier||'hci']:saved.draft};
  for(const [supplier,input]of Object.entries(candidates)){
   if(!input.project?.trim()||!input.units?.some(u=>u.items.length))continue;
   const sourceText=JSON.stringify(input),sha256=hash(sourceText);
   if(existing.some(j=>j.sources.some(s=>s.sha256===sha256))){skipped++;continue;}
   const dates=quoteDates(),state={version:2,supplier,project:input.project,status:'Tentative',quoteId:input.quoteId,date:input.date||dates.date,validUntil:input.validUntil||dates.validUntil,customer:input.customer||'',email:input.email||'',preparedBy:input.preparedBy||'Daniel Cruz',notes:input.notes||'',margin:input.margin,comparison:!!input.comparison,units:input.units.map(u=>({id:u.id,name:u.name,repeat:u.repeat,defaultLi:u.defaultLi??input.finish??0,auto:!!u.auto,items:u.items.map(i=>({sku:i.sku,li:i.li,qty:i.qty}))}))};
   const now=new Date().toISOString(),j=await app.store.create(actor,{id:randomUUID(),revision:1,state,sources:[{id:randomUUID(),kind:'instruction',name:'Imported human Pricing workspace',sha256,text:sourceText}],provenance:[],exceptions:[],catalog_hash:app.bidding.hashes[supplier],saved:true,created_at:now,updated_at:now});
   const result=await app.bidding.execute('price_bid',{job_id:j.id},actor);if(!result.ok)throw Error('Imported bid pricing verification failed.');
   console.log(JSON.stringify({imported:true,supplier,units:result.data.count,purchase:result.data.purchase,sale:result.data.sale,issues:result.data.issues.length}));imported++;
  }
 }
 console.log(JSON.stringify({imported,skipped}));
}finally{await app.store.close();}
