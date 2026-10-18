import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {executeServiceAction,readAeonContext} from '../src/agent-actions.mjs';
test('provider actions reject arbitrary hosts, paths, credentials endpoints and absent authentication',async()=>{
 for(const p of ['https://evil.test','../private','%2e%2e/private','agents/../private','credentials'])await assert.rejects(executeServiceAction({OPS_PAPERCLIP_URL:'http://paper.test',OPS_PAPERCLIP_COMPANY_ID:'company'},'paperclip',{service:'paperclip',method:'GET',path:p}));
 await assert.rejects(executeServiceAction({},'erpnext',{service:'erpnext',method:'GET',path:'resource/Quotation'}));
 await assert.rejects(executeServiceAction({},'users',{service:'users',method:'GET',path:'users'}));
});
test('provider mutation preserves company scope and redacts credentials',async()=>{
 let request;
 const value=await executeServiceAction({OPS_PAPERCLIP_URL:'http://paper.test',OPS_PAPERCLIP_COMPANY_ID:'company'},'paperclip',{service:'paperclip',method:'POST',path:'issues',body:{title:'Test draft'}},async(url,init)=>{request={url:String(url),init};return Response.json({id:'fixture',apiKey:'test-only',title:'Test draft'});});
 assert.equal(request.url,'http://paper.test/api/companies/company/issues');assert.equal(request.init.method,'POST');assert.equal(value.apiKey,'[REDACTED]');
});
test('AEON context includes only configured notes and engineering records, with source hashes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'aeon-context-'));const vault=path.join(root,'vault');
 try{
  await mkdir(path.join(root,'docs/continuity'),{recursive:true});await mkdir(vault);
  await writeFile(path.join(vault,'selected.md'),'Approved fixture');await writeFile(path.join(vault,'unrelated.md'),'Not selected');
  await writeFile(path.join(root,'docs/continuity/vault.json'),JSON.stringify({vault,projects:{'vulpine-platform':{records:[{role:'identity',path:'selected.md'}]}}}));
  for(const name of ['current.md','decisions.md'])await writeFile(path.join(root,'docs/continuity',name),'Engineering fixture');
  const value=await readAeonContext(root);assert.equal(value.records.length,1);assert.equal(value.records[0].path,'selected.md');assert.match(value.records[0].sha256,/^[a-f0-9]{64}$/);assert.equal(value.engineering.length,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
