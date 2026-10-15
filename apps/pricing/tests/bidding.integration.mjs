import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {createBiddingServer} from '../agent/server.mjs';
import {processRun} from '../agent/worker.mjs';
import {PDFDocument} from 'pdf-lib';
import XLSX from 'xlsx';
import fs from 'node:fs/promises';

test('persistent bids enforce ownership, scopes, revisions, real catalog costs and valid exports',async()=>{
 const env={...process.env,OPS_ORGANIZATION_ID:'qa-'+randomUUID(),BIDDING_PUBLIC_URL:'http://127.0.0.1:3029/'};
 assert.ok(env.BIDDING_DATABASE_URL,'Dedicated bidding database required');
 const app=await createBiddingServer(env,{worker:false});await new Promise(r=>app.server.listen(3029,'127.0.0.1',r));
 const actor={sub:randomUUID(),org:env.OPS_ORGANIZATION_ID,scopes:['bids.read','bids.write']};
 const call=(name,args,who=actor)=>app.bidding.execute(name,args,who);
 try{
  const instructions='Kitchen: 12 units. Each kitchen has 2 B24 cabinets. Rythern SW / SG finish.';
  const created=await call('create_bid_job',{project:'QA supplier acceptance',supplier:'rythern',instruction:instructions});assert.equal(created.ok,true,JSON.stringify(created));let j=created.data;
  assert.equal((await call('get_bid_job',{job_id:j.id},{...actor,sub:'another-user'})).error.code,'NOT_FOUND');
  assert.equal((await call('get_bid_job',{job_id:j.id},{...actor,org:'another-org'})).error.code,'NOT_FOUND');
  assert.equal((await call('save_bid',{job_id:j.id,expected_revision:1},{...actor,scopes:['bids.read']})).error.code,'FORBIDDEN');
  assert.equal((await call('update_bid_items',{job_id:j.id,expected_revision:1,unit_id:randomUUID(),items:[],price:1})).error.code,'INVALID_INPUT');
  const evidence={source_id:j.sources[0].id,quote:instructions};
  const mix=await call('set_unit_mix',{job_id:j.id,expected_revision:j.revision,units:[{name:'Kitchen',repeat:12,defaultLi:0,evidence}]});assert.equal(mix.ok,true,JSON.stringify(mix));j=mix.data;
  assert.equal((await call('save_bid',{job_id:j.id,expected_revision:1})).error.code,'REVISION_CONFLICT');
  assert.equal((await call('update_bid_items',{job_id:j.id,expected_revision:j.revision,unit_id:j.state.units[0].id,items:[{sku:'MADE-UP-SKU',li:0,qty:2,evidence}]})).error.code,'UNKNOWN_SKU');
  const updated=await call('update_bid_items',{job_id:j.id,expected_revision:j.revision,unit_id:j.state.units[0].id,items:[{sku:'B24',li:0,qty:2,evidence}]});assert.equal(updated.ok,true,JSON.stringify(updated));j=updated.data;
  const priced=await call('price_bid',{job_id:j.id});assert.equal(priced.ok,true,JSON.stringify(priced));assert.equal(priced.data.purchase,293784);assert.equal(priced.data.sale,367224);
  assert.equal((await call('validate_bid',{job_id:j.id})).data.valid,true);
  j=(await call('save_bid',{job_id:j.id,expected_revision:j.revision})).data;
  for(const format of ['pdf','xlsx']){
   const exported=await call('export_bid',{job_id:j.id,expected_revision:j.revision,format});assert.equal(exported.ok,true,JSON.stringify(exported));
   const response=await fetch(exported.data.url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());
   if(format==='pdf')assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
   else assert.equal(XLSX.read(bytes).Sheets['Unit Type'].B6.v,'B24');
  }
  // Exercise the official SDK's strict input/output registration and JSON-RPC dispatch.
  const {InMemoryTransport}=await import('@modelcontextprotocol/server');
  const {Client}=await import('@modelcontextprotocol/client');
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();const mcp=app.bidding.server(actor),client=new Client({name:'vulpine-acceptance',version:'1'});
  await mcp.connect(serverTransport);await client.connect(clientTransport);
  assert.equal((await client.listTools()).tools.length,10);
  assert.equal((await client.callTool({name:'price_bid',arguments:{job_id:j.id}})).structuredContent.data.purchase,293784);
  await client.close();await mcp.close();
  const {StreamableHTTPClientTransport}=await import('@modelcontextprotocol/client');
  const remote=new Client({name:'vulpine-http-acceptance',version:'1'});
  const signedFetch=async(url,init={})=>{
   const body=init.body||'',method=init.method||'GET',path=new URL(url).pathname.slice(1),claim={sub:actor.sub,org:actor.org,module:'pricing',path,method,exp:Math.floor(Date.now()/1000)+60,bodyHash:createHash('sha256').update(body).digest('hex')},payload=Buffer.from(JSON.stringify(claim)).toString('base64url'),headers=new Headers(init.headers);
   headers.set('x-vulpine-operations',payload+'.'+createHmac('sha256',env.OPS_SIGNING_SECRET).update(payload).digest('base64url'));return fetch(url,{...init,headers});
  };
  await remote.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3029/agent/mcp'),{fetch:signedFetch}));
  assert.equal((await remote.listTools()).tools.length,10);
  assert.equal((await remote.callTool({name:'price_bid',arguments:{job_id:j.id}})).structuredContent.data.sale,367224);await remote.close();
  const unsigned=await fetch('http://127.0.0.1:3029/agent/jobs');assert.equal(unsigned.status,401);
  const path='agent/jobs',body='',claim={sub:actor.sub,org:actor.org,module:'pricing',path,method:'GET',exp:Math.floor(Date.now()/1000)+60,bodyHash:createHash('sha256').update(body).digest('hex')},payload=Buffer.from(JSON.stringify(claim)).toString('base64url');
  const response=await fetch('http://127.0.0.1:3029/'+path,{headers:{'x-vulpine-operations':payload+'.'+createHmac('sha256',env.OPS_SIGNING_SECRET).update(payload).digest('base64url')}});assert.equal(response.status,200);assert.ok((await response.json()).jobs.some(x=>x.id===j.id));
  if(process.env.TEST_VERIFIED_BID_PATH){
   const state=JSON.parse(await fs.readFile(process.env.TEST_VERIFIED_BID_PATH,'utf8'));
   const created=await call('create_bid_job',{project:state.project,supplier:'hci',instruction:'Reconcile the previously verified, human-authored workbook snapshot.'});assert.equal(created.ok,true);
   const known=await app.store.mutate(actor,created.data.id,1,'qa_import_verified_workbook',j=>{j.state=state;j.saved=true;});
   const priced=await call('price_bid',{job_id:known.id});assert.equal(priced.data.count,85);assert.equal(priced.data.purchase,12999421);assert.equal(priced.data.sale,16665868);
   const exported=await call('export_bid',{job_id:known.id,expected_revision:known.revision,format:'pdf'});assert.equal(exported.ok,true);
   const bytes=await(await fetch(exported.data.url)).arrayBuffer();assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
  }
  if(process.env.TEST_OPENAI==='1'){
   const made=await call('create_bid_job',{project:'QA live assistant acceptance',supplier:'rythern',instruction:instructions});assert.equal(made.ok,true);
   const run=await app.store.saveRun(actor,made.data.id,instructions,1),claimed=await app.store.claimRun();assert.equal(claimed.id,run.id);
   await processRun({...app,env},claimed);const result=await app.store.getRun(actor,run.id);assert.equal(result.status,'completed',JSON.stringify(result.payload));assert.equal(result.payload.exports.length,2);
   const totals=await call('price_bid',{job_id:made.data.id});assert.equal(totals.data.purchase,293784);assert.equal(totals.data.sale,367224);
  }
 }finally{
  for(const table of ['bid_exports','bid_runs','bid_audit','bid_jobs'])await app.store.pool.query('DELETE FROM '+table+' WHERE org=$1',[actor.org]);
  await app.close();
 }
});
