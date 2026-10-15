import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {switchSupplier} from '../src/supplier-switch.mjs';
import {calculateProject,cost} from '../src/pricing.mjs';
const hci=JSON.parse(await fs.readFile(new URL('../src/catalog.json',import.meta.url)));
const rythern=JSON.parse(await fs.readFile(new URL('../src/suppliers/rythern.json',import.meta.url)));
test('supplier comparison carries exact SKUs and quantities, prices locally and retains unmatched items',()=>{
 const original={supplier:'hci',margin:20,units:[{id:'k',name:'Kitchen',repeat:12,defaultLi:0,auto:false,items:[{sku:'B24',qty:2,li:0},{sku:'UNMATCHED',qty:3,li:0}]}]};
 const before=structuredClone(original),next=switchSupplier(original,hci,rythern,'rythern');
 assert.deepEqual(original,before);assert.equal(next.units[0].repeat,12);assert.deepEqual(next.units[0].items.map(x=>[x.sku,x.qty]),[['B24',2],['UNMATCHED',3]]);
 const totals=calculateProject(rythern,next);assert.equal(totals.purchase,24*cost(rythern,0,'B24'));assert.ok(totals.issues.some(s=>s.includes('UNMATCHED')));
 const back=switchSupplier(next,rythern,hci,'hci',original);assert.equal(calculateProject(hci,back).purchase,24*cost(hci,0,'B24'));
});
test('automatic HCI trim is retained as explicit material for supplier comparison',()=>{
 const s={margin:20,units:[{id:'k',name:'Kitchen',repeat:1,defaultLi:0,auto:true,items:[{sku:'B24',qty:2,li:0}]}]};
 const before=calculateProject(hci,s),next=switchSupplier(s,hci,rythern,'rythern');
 assert.equal(next.units[0].auto,false);assert.deepEqual(next.units[0].items.map(x=>[x.sku,x.qty]),before.units[0].entries.map(x=>[x.sku,x.qty]));
});
