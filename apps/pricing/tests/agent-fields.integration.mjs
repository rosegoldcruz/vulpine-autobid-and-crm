import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createBiddingServer} from '../agent/server.mjs';
import {QuoteStore} from '../quote-store.mjs';
import {complete} from './proposal-fixture.mjs';
import {verifyTax} from '../tax-provider.mjs';
import {calculateProject} from '../src/pricing.mjs';

test('MCP edits draft/shared fields, signs tax and exports saved customer PDFs without a browser',async()=>{
 const env={...process.env,OPS_ORGANIZATION_ID:'qa-fields-'+randomUUID(),BIDDING_PUBLIC_URL:'http://127.0.0.1:3038/',TAXJAR_API_TOKEN:undefined};
 assert.ok(env.BIDDING_DATABASE_URL);
 const app=await createBiddingServer(env,{worker:false});await new Promise(resolve=>app.server.listen(3038,'127.0.0.1',resolve));
 const workspace=new QuoteStore(env.QUOTES_DATABASE_URL||env.BIDDING_DATABASE_URL);
 const actor={sub:randomUUID(),org:env.OPS_ORGANIZATION_ID,scopes:['bids.read','bids.write']};
 const remote=new Client({name:'fields-http-acceptance',version:'1'});
 const signedFetch=async(url,init={})=>{const body=init.body||'',method=init.method||'GET',path=new URL(url).pathname.slice(1),claim={sub:actor.sub,org:actor.org,module:'pricing',path,method,exp:Math.floor(Date.now()/1000)+60,bodyHash:createHash('sha256').update(body).digest('hex')},payload=Buffer.from(JSON.stringify(claim)).toString('base64url'),headers=new Headers(init.headers);headers.set('x-vulpine-operations',payload+'.'+createHmac('sha256',env.OPS_SIGNING_SECRET).update(payload).digest('base64url'));return fetch(url,{...init,headers});};
 const execute=(name,args,who=actor)=>app.bidding.execute(name,args,who);
 const call=async(name,args)=>{const r=await remote.callTool({name,arguments:args});assert.equal(r.structuredContent?.ok,true,JSON.stringify(r));return r.structuredContent.data;};
 try{
  await remote.connect(new StreamableHTTPClientTransport(new URL('agent/mcp',env.BIDDING_PUBLIC_URL),{fetch:signedFetch}));
  const names=(await remote.listTools()).tools.map(t=>t.name);
  for(const name of ['revise_project_quote','set_bid_details','set_bid_tax','set_project_quote_details','set_project_quote_tax','export_project_quote'])assert.ok(names.includes(name),name);
  let j=await call('create_bid_job',{project:'Disposable fields acceptance',instruction:'One apartment; two White Shaker B24 cabinets.',margin:20});
  j=await app.store.mutate(actor,j.id,j.revision,'fixture',value=>{value.state=complete({...value.state,units:[{id:randomUUID(),name:'A1',repeat:1,auto:false,defaultLi:0,items:[{sku:'B24',li:0,qty:2}]}]});value.saved=true;});
  const original=calculateProject(app.catalogs.hci,j.state);
  j=await call('set_bid_details',{job_id:j.id,expected_revision:j.revision,customer:'Fixture GC',email:'fixture@example.test',preparedBy:'Mike Musonda',notes:'Internal workflow must remain private.',projectInfo:{contact:'Fixture contact'},customerSections:{included:'HCI White Shaker cabinetry',addenda:'WE ACKNOWLEDGE ADDENDUM 1 AND ADDENDUM 2.'},charges:{freight:{supplierCost:1000}}});
  assert.equal(j.state.projectInfo.apartments,1);assert.equal(j.state.projectInfo.contact,'Fixture contact');assert.equal(j.state.email,'fixture@example.test');assert.equal(j.saved,false);
  assert.equal((await execute('set_bid_tax',{job_id:j.id,expected_revision:j.revision,rate_percent:9.25},{...actor,sub:'other'})).error.code,'NOT_FOUND');
  for(const rate of [-1,101])assert.equal((await execute('set_bid_tax',{job_id:j.id,expected_revision:j.revision,rate_percent:rate})).error.code,'INVALID_INPUT');
  assert.equal((await execute('set_bid_tax',{job_id:j.id,expected_revision:j.revision})).error.code,'VALIDATION_FAILED');
  j=await call('set_bid_tax',{job_id:j.id,expected_revision:j.revision,mode:'manual',rate_percent:9.25});verifyTax(j.state.tax,env);assert.equal(j.state.tax.lookup.rate,.0925);assert.equal(j.state.tax.lookup.enteredBy,actor.sub);assert.equal(j.state.tax.lookup.taxableItems.freight,false);
  let p=await call('price_bid',{job_id:j.id});assert.equal(p.revenue,original.revenue);assert.equal(p.tax.taxableAmount,p.revenue);assert.equal(p.tax.amount,Math.round(p.revenue*.0925));
  j=await call('save_bid',{job_id:j.id,expected_revision:j.revision});
  const published=await call('save_bid_to_project',{job_id:j.id,expected_revision:j.revision});
  let q=await call('get_project_quote',{quote_id:published.quote_id});const originalBytes=await workspace.download(actor,published.document_id),originalHash=createHash('sha256').update(originalBytes.bytes).digest('hex');
  const ref={quote_id:q.quote_id,expected_revision:q.revision};
  for(const name of ['set_project_quote_details','set_project_quote_tax','export_project_quote']){
   const fields=name==='set_project_quote_details'?{email:'changed@example.test'}:name==='set_project_quote_tax'?{rate_percent:6.75}:{format:'pdf',type:'customer'};
   assert.equal((await execute(name,{...ref,...fields},{...actor,scopes:['bids.read']})).error.code,'FORBIDDEN');
   assert.equal((await execute(name,{...ref,...fields},{...actor,org:'another-org'})).error.code,'NOT_FOUND');
   assert.equal((await execute(name,{...ref,expected_revision:99,...fields})).error.code,'REVISION_CONFLICT');
  }
  const units=structuredClone(q.state.units),margin=q.state.margin;
  let changed=await call('set_project_quote_details',{...ref,customer:'Updated GC',email:'changed@example.test',notes:'Private internal notes.',projectInfo:{contact:'Second contact'},customerSections:{basis:'Highland Cabinetry comparison must not expose supplier'},charges:{handles:{supplierCost:500}}});
  assert.deepEqual(changed.state.units,units);assert.equal(changed.state.margin,margin);assert.equal(changed.state.projectInfo.apartments,1);assert.equal(changed.state.customerSections.addenda,j.state.customerSections.addenda);assert.equal(changed.state.charges.freight.supplierCost,1000);assert.equal(changed.totals.revenue,original.revenue);
  assert.equal((await execute('set_project_quote_details',{quote_id:q.quote_id,expected_revision:changed.revision,margin:50})).error.code,'INVALID_INPUT');
  assert.equal((await execute('set_project_quote_details',{quote_id:q.quote_id,expected_revision:changed.revision,tax:{...changed.state.tax,lookup:{...changed.state.tax.lookup,signature:'forged'}}})).error.code,'VALIDATION_FAILED');
  const blocked=await execute('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:changed.revision,mode:'automatic'});assert.equal(blocked.error.code,'PROVIDER_UNAVAILABLE');assert.match(blocked.error.message,/configured TaxJar/);
  assert.equal((await call('get_project_quote',{quote_id:q.quote_id})).revision,changed.revision);
  changed=await call('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:changed.revision,rate_percent:6.75,address:{street:'',city:'',state:'',zip:''}});verifyTax(changed.state.tax,env);assert.equal(changed.totals.tax.rate,.0675);assert.equal(changed.totals.tax.amount,Math.round(original.revenue*.0675));assert.equal(changed.totals.profit,original.profit-500);
  const exported=await remote.callTool({name:'export_project_quote',arguments:{quote_id:q.quote_id,expected_revision:changed.revision,format:'pdf',type:'customer'}});assert.equal(exported.structuredContent.ok,true,JSON.stringify(exported));assert.ok(exported.content.some(c=>c.type==='resource_link'));
  const bytes=Buffer.from(await(await fetch(exported.structuredContent.data.url)).arrayBuffer()),text=spawnSync('pdftotext',['-layout','-','-'],{input:bytes,encoding:'utf8'});assert.equal(text.status,0,text.stderr);assert.match(text.stdout,/6\.7500%/);assert.match(text.stdout.replace(/\s+/g,' '),/WE ACKNOWLEDGE ADDENDUM 1 AND ADDENDUM 2/);assert.doesNotMatch(text.stdout,/\bHCI\b|Highland|Private internal notes/);
  q=await call('get_project_quote',{quote_id:q.quote_id});assert.equal(q.revision,changed.revision);assert.equal(q.state.email,'changed@example.test');assert.ok(q.documents.some(d=>d.id===exported.structuredContent.data.document_id));assert.equal(createHash('sha256').update((await workspace.download(actor,published.document_id)).bytes).digest('hex'),originalHash);
  const xlsx=await call('export_project_quote',{quote_id:q.quote_id,expected_revision:q.revision,format:'xlsx',type:'purchase'});assert.equal((await fetch(xlsx.url)).status,200);
  changed=await call('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:q.revision,rate_percent:0});assert.equal(changed.totals.tax.amount,0);
  assert.equal((await execute('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:changed.revision,mode:'exempt'})).error.code,'INVALID_INPUT');
  changed=await call('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:changed.revision,mode:'exempt',address:{street:'123 Test St',city:'Phoenix',state:'AZ',zip:'85001'},exemption:{reason:'Fixture exemption',document:'Fixture certificate',authority:'Fixture authority',validFrom:'2026-01-01',validUntil:'2099-12-31'}});verifyTax(changed.state.tax,env);assert.equal(changed.totals.tax.amount,0);
  await workspace.pool.query("UPDATE pricing_quotes SET state=jsonb_set(state,'{issuedAt}',to_jsonb('2026-10-19'::text)) WHERE id=$1 AND org=$2",[q.quote_id,actor.org]);
  assert.equal((await execute('set_project_quote_details',{quote_id:q.quote_id,expected_revision:changed.revision,email:'forbidden@example.test'})).error.code,'ISSUED_QUOTE');assert.equal((await execute('set_project_quote_tax',{quote_id:q.quote_id,expected_revision:changed.revision,rate_percent:9.25})).error.code,'ISSUED_QUOTE');
  const revised=await call('revise_project_quote',{quote_id:q.quote_id,expected_revision:changed.revision});assert.notEqual(revised.quote_id,q.quote_id);assert.equal(revised.revision,1);assert.equal(revised.state.signature,undefined);assert.equal(revised.state.issuedAt,undefined);assert.equal(revised.state.revisionOf,q.state.quoteId);assert.deepEqual(revised.state.units,units);
  await workspace.pool.query("UPDATE pricing_quotes SET state=state-'pricingPolicy' WHERE id=$1 AND org=$2",[revised.quote_id,actor.org]);
  const legacy=await call('get_project_quote',{quote_id:revised.quote_id});const editedLegacy=await call('set_project_quote_details',{quote_id:revised.quote_id,expected_revision:legacy.revision,email:'legacy@example.test'});assert.equal(editedLegacy.state.pricingPolicy,undefined);assert.equal(editedLegacy.totals.sale,legacy.calculation.sale);assert.equal((await execute('set_project_quote_tax',{quote_id:revised.quote_id,expected_revision:editedLegacy.revision,rate_percent:9.25})).error.code,'VALIDATION_FAILED');
  await workspace.project(actor,j.state.project,'delete');assert.equal((await execute('export_project_quote',{quote_id:q.quote_id,expected_revision:changed.revision,format:'pdf'})).error.code,'ARCHIVED_PROJECT');
 }finally{
  await remote.close().catch(()=>{});
  for(const table of ['pricing_quote_deletions','pricing_quote_exports','pricing_quote_revisions','pricing_quotes','pricing_projects'])await workspace.pool.query('DELETE FROM '+table+' WHERE org=$1',[actor.org]);
  for(const table of ['bid_exports','bid_runs','bid_audit','bid_job_revisions','bid_jobs'])await app.store.pool.query('DELETE FROM '+table+' WHERE org=$1',[actor.org]);
  await workspace.close();await app.close();
 }
});
