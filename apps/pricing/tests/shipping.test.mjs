import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cost} from '../src/pricing.mjs';
const data=JSON.parse(await readFile(new URL('../src/catalog.json',import.meta.url),'utf8'));
test('shipping uses full source rates for every Shaker finish',()=>{
  for(let line=0;line<8;line++){
    assert.equal(cost(data,line,'Delivery 1 - 50 Miles'),25000);
    assert.equal(cost(data,line,'Residential Delivery'),22000);
    assert.equal(cost(data,line,'Feight Handling Fee'),9500);
    assert.equal(cost(data,line,'CO Springs - 3rd Party Delivery'),58000);
  }
  assert.equal(cost(data,0,'B15'),12546);
});
