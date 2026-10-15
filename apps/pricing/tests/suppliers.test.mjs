import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {cost,calculateProject} from '../src/pricing.mjs';
import {createWorkbook} from '../src/quote-xlsx.mjs';
import {generateQuote} from '../src/quote-pdf.mjs';
import XLSX from 'xlsx';
import * as PDFLib from 'pdf-lib';
const read=async name=>JSON.parse(await fs.readFile(new URL('../src/'+name,import.meta.url)));
const [hci,rythern,uscd]=await Promise.all(['catalog.json','suppliers/rythern.json','suppliers/uscd.json'].map(read));
test('supplier costs retain independent source bases and exact SKUs',()=>{
 assert.equal(cost(hci,0,'B24'),14953);
 assert.equal(cost(rythern,0,'B24'),12241);
 assert.equal(rythern.Rythern.length,461);
 assert.equal(cost(rythern,0,'TK8'),null);
 const li=uscd.lines.findIndex(l=>l[0]==='Shaker White (RTA)'),row=uscd[uscd.lines[li][1]].find(r=>r[12].baseSku==='B24');
 assert.ok(row);assert.equal(cost(uscd,li,row[0]),Math.round(row[2]*100));assert.equal(cost(uscd,li,'B24'),null);
 const assembled=uscd.lines.findIndex(l=>l[0]==='Shaker White (Assembled)');
 assert.equal(cost(uscd,assembled,row[0]),Math.round(row[3]*100));
});
test('Rythern uses shared engine, preserves exact exported SKU, and generates a two-page customer quote',async()=>{
 const state={version:2,supplier:'rythern',project:'Supplier regression',quoteId:'QA-RYTHERN',customer:'',email:'',preparedBy:'Daniel Cruz',notes:'',status:'Tentative',margin:20,units:[{id:'qa',name:'Kitchen',repeat:12,auto:false,defaultLi:0,items:[{sku:'B24',li:0,qty:2}]}]};
 const result=calculateProject(rythern,state);assert.deepEqual(result.issues,[]);assert.equal(result.purchase,293784);assert.equal(result.sale,367224);
 const book=createWorkbook(XLSX,rythern,state);assert.equal(book.Sheets['Unit Type'].B6.v,'B24');assert.equal(book.Sheets['Unit Type'].F6.v,122.41);
 const template=await fs.readFile(new URL('../assets/proposal-template.pdf',import.meta.url));
 const pdf=await generateQuote(PDFLib,rythern,state,'customer',template);assert.equal((await PDFLib.PDFDocument.load(pdf)).getPageCount(),2);
});
