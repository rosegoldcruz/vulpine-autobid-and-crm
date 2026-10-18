import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../src/catalog.json',import.meta.url),'utf8'));
const row=(f,sku)=>data[f].find(r=>r[0]===sku);
test('all source-backed cabinet and accessory records remain present',()=>{
 assert.equal(data.Shaker.length,288);assert.equal(data.Euro.length,222);
 for(const rows of Object.values(data)){
  assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);
  for(const r of rows)for(const p of r.slice(2,5))assert.ok(p==='Unavailable'||(typeof p==='number'&&Number.isFinite(p)&&p>=0));
 }
 for(const sku of ['SM8','SCM2 1/4','TK8'])assert.ok(row('Shaker',sku));
});
test('known purchase costs and quantity totals reconcile',()=>{
 assert.equal(row('Shaker','B15')[2],125.46);
 assert.equal(row('Euro','B15')[3],106.90);
 assert.equal(Math.round((2*row('Shaker','B15')[2]+row('Shaker','TK8')[2])*100)/100,260.51);
 assert.equal(Math.round((2*row('Euro','B15')[3]+row('Euro','TK8')[3])*100)/100,234.40);
});
test('unpriced items remain unavailable and kits remain required',()=>{
 assert.equal(row('Euro','BLS36-Tray')[2],'Unavailable');
 assert.equal(row('Shaker','MIRROR2430')[4],'Unavailable');
 assert.equal(row('Euro','BWBK18')[8],'Trash Kit');
 assert.ok(!JSON.stringify(data).includes('512 MSRP'));
});
