import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {signClaim,verifyClaim,hashBody,commercialSummary,validateDraft,redact,leadAssessment} from '../src/core.mjs';
import {createOperationsServer} from '../src/server.mjs';
const secret='test-only-operations-key-not-used-in-production';
test('lead scoring requires explicit evidence and remains distinct from automated discovery',()=>{
 assert.equal(leadAssessment({websiteStatus:'missing'}).opportunityScore,null);
 const s=leadAssessment({websiteStatus:'missing',scoreEvidence:'Operator checked source on 2026-10-04',phone:'test',reviewCount:3});
 assert.equal(s.opportunityScore,100);assert.match(s.assessmentStatus,/not automatically verified/);
 assert.throws(()=>validateDraft({title:'x',probability:101}));
});
test('claims bind the organization, operation, method, body and expiration',()=>{
 const expected={module:'leads',method:'POST',org:'test-org',bodyHash:hashBody('{}')};
 const c={...expected,sub:'test-user',exp:Date.now()/1000+30};
 const token=signClaim(c,secret);
 assert.ok(verifyClaim(token,secret,expected));
 for(const change of [{org:'other-org'},{method:'DELETE'},{module:'settings'},{bodyHash:hashBody('changed')}])assert.equal(verifyClaim(token,secret,{...expected,...change}),null);
 assert.equal(verifyClaim(signClaim({...c,exp:0},secret),secret,expected),null);
 assert.equal(verifyClaim(token,'different-key-that-is-at-least-32-characters',expected),null);
});
test('commercial values preserve unknown revenue and exclude unknown statuses',()=>{
 const s=commercialSummary([{status:'Sent',bid_amount:100,projected_profit:20},{status:'Won',bid_amount:50},{status:'mystery',bid_amount:900},{status:'Lost',bid_amount:null}]);
 assert.equal(s.pipelineValue,100);assert.equal(s.wonValue,50);assert.equal(s.revenue,null);assert.equal(s.profitCoverage,'1/4');assert.equal(s.unknownValue,1);
});
test('draft validation rejects executable URLs and overlong content',()=>{
 assert.throws(()=>validateDraft({title:'x',website:'javascript:alert(1)'}));
 assert.throws(()=>validateDraft({title:''}));
 assert.equal(validateDraft({title:'a',secret:'not copied'}).secret,undefined);
 assert.ok(!redact('token=privatevalue Bearer exampletoken').includes('privatevalue'));
});
test('operator CRUD is durable, audited, scoped, and protects concurrent edits',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'vulpine-operations-test-'));
 const server=createOperationsServer({OPS_SIGNING_SECRET:secret,OPS_ORGANIZATION_ID:'test-org',OPS_STORAGE_PATH:root});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(method,body,module='leads',org='test-org')=>{const text=body?JSON.stringify(body):'';return fetch(`${base}/modules/${module}`,{method,headers:{'content-type':'application/json','x-vulpine-operations':signClaim({sub:'test-user',org,module,method,bodyHash:hashBody(text),exp:Date.now()/1000+30},secret)},body:body?text:undefined})};
 try{
  assert.equal((await fetch(`${base}/modules/leads`)).status,401);
  assert.equal((await request('POST',{title:'Test record'},'leads','other')).status,401);
  assert.equal((await request('POST',{title:'Test record'})).status,200);
  const data=await (await request('GET')).json(), record=data.records[0];assert.equal(record.details.createdBy,'test-user');
  assert.equal((await request('PATCH',{id:record.id,title:'Changed',updatedAt:'stale'})).status,409);
  assert.equal((await request('PATCH',{id:record.id,title:'Changed',updatedAt:record.details.updatedAt})).status,200);
  const updated=(await(await request('GET')).json()).records[0];assert.equal(updated.title,'Changed');
  assert.equal((await request('POST',{title:'Cannot send',status:'Sent'},'emailblaster')).status,400);
  assert.equal((await request('POST',{title:'Cannot change ledger'},'revenue')).status,405);
  assert.equal((await request('DELETE',{id:updated.id,updatedAt:updated.details.updatedAt})).status,200);
  assert.equal((await(await request('GET')).json()).records.length,0);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
