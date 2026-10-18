import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {generateQuote} from '../src/quote-pdf.mjs';
import {calculateProject} from '../src/pricing.mjs';

const data=JSON.parse(await fs.readFile(new URL('../src/catalog.json',import.meta.url)));
const template=await fs.readFile(new URL('../assets/proposal-template.pdf',import.meta.url));
const state={project:'Customer proposal regression',quoteId:'QA-SUMMARY',customer:'Proposal review',email:'',preparedBy:'Daniel Cruz',notes:'Cabinet supply only. Installation excluded.',margin:30,status:'Tentative',comparison:false,
 units:Array.from({length:12},(_,i)=>({id:String(i),name:'Unit type '+(i+1)+' - two bedroom standard',repeat:8,auto:true,items:['B12','B15','B18','B21','B24','B27','B30','B33','B36'].map(sku=>({sku,li:0,qty:2}))}))};

test('customer proposal summarizes unit types, regardless of SKU count, notes or long names',async()=>{
 const before=calculateProject(data,state);assert.equal(before.issues.length,0);
 assert.ok(before.units.flatMap(u=>u.entries).length>100);
 const bytes=await generateQuote(PDFLib,data,state,'customer',template);
 assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),5);
 assert.deepEqual(calculateProject(data,state),before);
});
test('customer schedule continues only when unit type rows exceed page capacity',async()=>{
 const input={...state,units:Array.from({length:21},(_,i)=>({...state.units[0],id:String(i),name:'Unit '+i}))};
 const bytes=await generateQuote(PDFLib,data,input,'customer',template);
 assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),6);
});
