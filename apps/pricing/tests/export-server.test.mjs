import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHmac,createHash} from 'node:crypto';
import XLSX from 'xlsx';
import {PDFDocument} from 'pdf-lib';
import {createWorkbook} from '../src/quote-xlsx.mjs';
import {calculateProject} from '../src/pricing.mjs';
import {createServer} from '../server.mjs';
const data=JSON.parse(await fs.readFile(new URL('../src/catalog.json',import.meta.url)));
const state={version:2,project:'Export QA',quoteId:'QA-1',date:'2026-10-14',status:'Tentative',customer:'QA',notes:'',email:'',comparison:false,preparedBy:'Daniel Cruz',margin:30,units:[{id:'one',name:'Kitchen',repeat:12,auto:true,items:[{sku:'B24',li:7,qty:3},{sku:'2DB24',li:4,qty:1}]},{id:'two',name:'Bath',repeat:8,auto:false,items:[{sku:'B15',li:0,qty:2}]}]};
test('Excel round trip preserves exact SKUs, finishes, unit multipliers and pricing totals',()=>{
  const wb=createWorkbook(XLSX,data,state),bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),read=XLSX.read(bytes),p=calculateProject(data,state);
  assert.deepEqual(read.SheetNames,['Summary Sheet','Unit Type','Unit Type (2)']);
  assert.equal(read.Sheets['Unit Type'].B6.v,'B24');assert.equal(read.Sheets['Unit Type'].E6.v,'Mountain Timber Shaker');
  assert.equal(read.Sheets['Summary Sheet'].E9.v,p.purchase/100);
  assert.equal(Math.round(read.Sheets['Summary Sheet'].E7.v*100),p.units[0].purchase*12);
  assert.equal(read.Sheets['Unit Type'].G6.f,'ROUND(C6*F6,2)');
  assert.throws(()=>createWorkbook(XLSX,data,{...state,units:[{...state.units[0],items:[{sku:'NOT-A-SKU',li:0,qty:1}]}]}));
});
test('server denies unsigned / cross-organization requests, isolates drafts, rejects stale saves, exports real files',async()=>{
  const storage=await fs.mkdtemp(path.join(os.tmpdir(),'vulpine-qa-'));
  const secret='test-only-secret-at-least-32-characters',env={OPS_SIGNING_SECRET:secret,OPS_ORGANIZATION_ID:'qa-org',CABINET_STORAGE_PATH:storage};
  const server=await createServer(env);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(route,method='GET',input,sub='qa-user',org='qa-org'){
    const body=input?JSON.stringify(input):'',claims={sub,org,module:'pricing',path:route,method,exp:Math.floor(Date.now()/1000)+60,bodyHash:createHash('sha256').update(body).digest('hex')};
    const p=Buffer.from(JSON.stringify(claims)).toString('base64url'),sig=createHmac('sha256',secret).update(p).digest('base64url');
    return fetch(base+'/'+route,{method,headers:{'x-vulpine-operations':p+'.'+sig},body:body||undefined});
  }
  try{
    assert.equal((await fetch(base+'/catalog.json')).status,401);
    assert.equal((await request('catalog.json','GET',undefined,'qa-user','other-org')).status,401);
    assert.equal((await request('catalog.json')).status,200);
    let saved=await request('draft','PUT',{draft:state,revision:null});assert.equal(saved.status,200);
    assert.deepEqual((await (await request('draft')).json()).draft,state);
    assert.equal((await (await request('draft','GET',undefined,'other-user')).json()).draft,null);
    assert.equal((await request('draft','PUT',{draft:state,revision:null})).status,409);
    const excel=await request('export','POST',{state,format:'xlsx'});assert.equal(excel.status,200);assert.equal(XLSX.read(await excel.arrayBuffer()).Sheets['Unit Type'].B6.v,'B24');
    const pdf=await request('export','POST',{state,format:'pdf',type:'customer'});assert.equal(pdf.status,200);assert.equal((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount(),2);
  }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(storage,{recursive:true,force:true});}
});
