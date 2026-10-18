import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {US_STATES,taxSummary} from '../src/tax.mjs';
import {lookupTax,verifyTax} from '../tax-provider.mjs';
import {calculateProject} from '../src/pricing.mjs';
import {generateQuote} from '../src/quote-pdf.mjs';
import * as PDFLib from 'pdf-lib';
const env={TAXJAR_API_TOKEN:'test-only',OPS_SIGNING_SECRET:'test-only-secret-at-least-32-characters'};
const address={street:'123 Test St',city:'Phoenix',state:'AZ',zip:'85001'};
const response=()=>Promise.resolve({ok:true,json:async()=>({rate:{state:'AZ',county:'Test county',city:'Test city',state_rate:'0.05',county_rate:'0.01',city_rate:'0.02',combined_district_rate:'0.005',combined_rate:'0.085'}})});
test('nationwide selector covers 50 states and DC; provider input includes full destination',async()=>{
 assert.equal(Object.keys(US_STATES).length,51);
 let requested;const lookup=await lookupTax(address,env,async(url)=>{requested=url;return response()});
 assert.equal(requested.searchParams.get('street'),'123 TEST ST');assert.equal(requested.searchParams.get('state'),'AZ');
 const tax={enabled:true,address,lookup};verifyTax(tax,env);
 assert.equal(taxSummary(tax,10001).amount,850);
 assert.equal(taxSummary(tax,10001).total,10851);
 assert.equal(taxSummary({...tax,enabled:false},10001).total,10001);
 assert.ok(taxSummary({...tax,address:{...address,city:'Tucson'}},10001).issue);
 assert.ok(taxSummary(tax,10001,Date.now()+86400001).issue);
 assert.throws(()=>verifyTax({...tax,lookup:{...lookup,rate:0}},env));
});
test('missing configuration, malformed rates, wrong state and network failures never become zero tax',async()=>{
 await assert.rejects(lookupTax(address,{}),/connected tax service/);
 await assert.rejects(lookupTax({...address,zip:'abc'},env),/ZIP/);
 await assert.rejects(lookupTax(address,env,async()=>{throw Error('network')}),/did not respond/);
 await assert.rejects(lookupTax(address,env,async()=>({ok:true,json:async()=>({rate:{state:'CA'}})})),/different state/);
 await assert.rejects(lookupTax(address,env,async()=>({ok:true,json:async()=>({rate:{state:'AZ',combined_rate:'0'}})})),/incomplete/);
});
test('Avalara preserves individual districts and accepts a verified zero rate',async()=>{
 const av={AVALARA_ACCOUNT_ID:'test',AVALARA_LICENSE_KEY:'test',OPS_SIGNING_SECRET:env.OPS_SIGNING_SECRET};
 const lookup=await lookupTax(address,av,async()=>({ok:true,json:async()=>({totalRate:0,rates:[{name:'No sales tax',type:'State',rate:0}]})}));
 assert.equal(taxSummary({enabled:true,address,lookup},1200).amount,0);
 verifyTax({enabled:true,address,lookup},av);
});
test('customer tax changes payable total, never purchase cost or gross profit; PDF includes tax page',async()=>{
 const data=JSON.parse(await fs.readFile(new URL('../src/catalog.json',import.meta.url)));
 const state={version:2,project:'Tax QA',quoteId:'TAX-QA',customer:'QA',email:'',notes:'',preparedBy:'Daniel Cruz',status:'Tentative',margin:20,units:[{id:'1',name:'Kitchen',repeat:2,auto:false,items:[{sku:'B24',li:0,qty:3}]}]};
 const before=calculateProject(data,state);state.tax={enabled:true,address,lookup:await lookupTax(address,env,response)};
 const after=calculateProject(data,state);assert.equal(after.profit,before.profit);assert.equal(after.purchase,before.purchase);assert.equal(after.sale,before.sale);assert.equal(after.total,before.sale+Math.round(before.sale*.085));
 const template=await fs.readFile(new URL('../assets/proposal-template.pdf',import.meta.url));
 const pdf=await generateQuote(PDFLib,data,state,'customer',template);assert.equal((await PDFLib.PDFDocument.load(pdf)).getPageCount(),6);
 state.tax.lookup=null;assert.ok(calculateProject(data,state).issues.some(s=>s.includes('tax')));
 await assert.rejects(generateQuote(PDFLib,data,state,'customer',template));
});
