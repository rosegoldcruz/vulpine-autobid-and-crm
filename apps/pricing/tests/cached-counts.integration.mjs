import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createBiddingServer} from '../agent/server.mjs';
import {QuoteStore} from '../quote-store.mjs';
import {complete} from './proposal-fixture.mjs';
import {calculateProject} from '../src/pricing.mjs';

test('cached details tools classify supplier items, price pulls and manual tax without editing quantities or costs',async()=>{
 const env={...process.env,OPS_ORGANIZATION_ID:'qa-cached-counts-'+randomUUID(),TAXJAR_API_TOKEN:undefined};
 const app=await createBiddingServer(env,{worker:false}),workspace=new QuoteStore(env.QUOTES_DATABASE_URL||env.BIDDING_DATABASE_URL);
 const actor={sub:randomUUID(),org:env.OPS_ORGANIZATION_ID,scopes:['bids.read','bids.write']};
 const execute=(name,args,who=actor)=>app.bidding.execute(name,args,who);
 let job;
 try{
  const unitId=randomUUID(),state=complete({supplier:'rythern',project:'Cached counts fixture',quoteId:'QA-CACHED-COUNTS',customer:'Fixture GC',email:'',notes:'',preparedBy:'Daniel Cruz',status:'Tentative',margin:13,comparison:false,projectInfo:{apartments:16,mixEvidence:'Fixture: sixteen homes',cabinetLine:'White Shaker',finishBasis:'Disclosed fixture alternate'},units:[{id:unitId,name:'A',kind:'apartment',repeat:16,auto:false,defaultLi:0,items:[{sku:'B24',li:0,qty:2,handleCount:3},{sku:'F342',li:0,qty:1,handleCount:0}]}]});
  const before=calculateProject(app.catalogs.rythern,state),ref=await workspace.save(actor,state);
  const units=[{unit_id:unitId,items:[{sku:'B24',li:0,boxCount:1,handleCount:3,configurationBasis:'Catalog: two doors and one working drawer.'},{sku:'F342',li:0,boxCount:0,handleCount:0,configurationBasis:'Filler trim: no body or operating fronts.'}]}];
  const args={quote_id:ref.id,expected_revision:ref.revision,projectInfo:{cabinetConfigurations:units}};
  assert.equal((await execute('set_project_quote_details',args,{...actor,scopes:['bids.read']})).error.code,'FORBIDDEN');
  assert.equal((await execute('set_project_quote_details',args,{...actor,org:'other'})).error.code,'NOT_FOUND');
  for(const bad of [null,[],[{...units[0],items:[{...units[0].items[0],price:1}]}],[{...units[0],items:[{...units[0].items[0],qty:99}]}]])assert.equal((await execute('set_project_quote_details',{...args,projectInfo:{cabinetConfigurations:bad}})).error.code,'INVALID_INPUT');
  assert.equal((await execute('set_project_quote_details',{...args,projectInfo:{cabinetConfigurations:[{...units[0],items:[{...units[0].items[0],boxCount:0}]}]}})).error.code,'INVALID_INPUT');
  const changed=await execute('set_project_quote_details',args);assert.equal(changed.ok,true,JSON.stringify(changed));
  assert.equal(changed.data.state.projectInfo.cabinetConfigurations,undefined);
  assert.equal(changed.data.state.units[0].items[0].qty,2);assert.equal(changed.data.state.margin,13);assert.equal(changed.data.totals.purchase,before.purchase);
  assert.equal(changed.data.totals.charges.boxes,32);assert.equal(changed.data.totals.charges.handles.quantity,96);assert.equal(changed.data.totals.revenue,before.revenue+96*333);
  assert.equal((await execute('set_project_quote_details',args)).error.code,'REVISION_CONFLICT');
  const taxed=await execute('set_project_quote_tax',{quote_id:ref.id,expected_revision:changed.data.revision,mode:'manual',rate_percent:6});assert.equal(taxed.ok,true,JSON.stringify(taxed));assert.equal(taxed.data.totals.tax.amount,Math.round(taxed.data.totals.revenue*.06));
  const created=await execute('create_bid_job',{project:'Cached draft fixture',supplier:'rythern',margin:13,instruction:'Fixture'});assert.equal(created.ok,true);job=created.data;
  job=await app.store.mutate(actor,job.id,job.revision,'fixture',j=>{j.state=structuredClone(state);});
  const draft=await execute('set_bid_details',{job_id:job.id,expected_revision:job.revision,projectInfo:{cabinetConfigurations:units}});assert.equal(draft.ok,true,JSON.stringify(draft));
  const priced=await execute('price_bid',{job_id:job.id});assert.equal(priced.data.charges.boxes,32);assert.equal(priced.data.charges.handles.quantity,96);assert.equal(priced.data.margin,13);
  await workspace.pool.query("UPDATE pricing_quotes SET state=jsonb_set(state,'{issuedAt}',to_jsonb('2026-10-21'::text)) WHERE id=$1 AND org=$2",[ref.id,actor.org]);
  assert.equal((await execute('set_project_quote_details',{...args,expected_revision:taxed.data.revision})).error.code,'ISSUED_QUOTE');
 }finally{
  for(const table of ['pricing_quote_revisions','pricing_quotes','pricing_projects'])await workspace.pool.query('DELETE FROM '+table+' WHERE org=$1',[actor.org]);
  for(const table of ['bid_exports','bid_runs','bid_audit','bid_job_revisions','bid_jobs'])await app.store.pool.query('DELETE FROM '+table+' WHERE org=$1',[actor.org]);
  await workspace.close();await app.close();
 }
});
