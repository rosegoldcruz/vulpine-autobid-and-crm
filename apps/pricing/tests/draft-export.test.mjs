import test from 'node:test';
import assert from 'node:assert/strict';
import {draftExportState,planReviewWarnings} from '../agent/draft-export.mjs';

test('draft exports preserve review warnings and scope exclusions without approving or repricing the job',async()=>{
 const job={state:{notes:'Original source discrepancies.',margin:15,units:[{items:[{sku:'B24',qty:2}]}]},exceptions:['Plan-derived quantities require human review.','Missing supplier pricing.']};
 const before=structuredClone(job),state=draftExportState(job,'1,396 Brighton Pearl bases and four Panna cabinets excluded.');
 assert.deepEqual(job,before);
 assert.equal(state.margin,15);
 assert.deepEqual(state.units,job.state.units);
 assert.match(state.notes,/not a complete project bid/);
 assert.match(state.notes,/1,396 Brighton Pearl/);
 assert.match(state.notes,/Plan-derived quantities require human review/);
 assert.match(state.notes,/Original source discrepancies/);
 assert.equal(planReviewWarnings.has('Missing supplier pricing.'),false);
});
