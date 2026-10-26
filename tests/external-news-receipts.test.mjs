import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcile} from '../scripts/research/news-receipt-check.mjs';

const evidence=[{factor_key:'headline_count',subject:'NVDA',observed_at:'2026-10-26T12:00:00Z',source_metadata:{articleIds:['massive:abc']}}];
const article={id:'abc',published_utc:'2026-10-26T11:00:00Z',tickers:['NVDA'],article_url:'https://example.com/story',publisher:{name:'Example Publisher'}};
test('external receipt matches identifier and chronology',()=>{
 assert.deepEqual(reconcile({evidence,external:[article]}).counts,{matched:1,missing:0,invalid:0});
});
test('unmatched external ID fails closed',()=>{
 assert.equal(reconcile({evidence,external:[]}).counts.missing,1);
});
test('article published after observation is invalid',()=>{
 assert.equal(reconcile({evidence,external:[{...article,published_utc:'2026-10-27T00:00:00Z'}]}).counts.invalid,1);
});
test('wrong ticker is invalid',()=>{
 assert.equal(reconcile({evidence,external:[{...article,tickers:['AAPL']}]}).counts.invalid,1);
});
test('missing publisher provenance is invalid',()=>{
 assert.equal(reconcile({evidence,external:[{...article,publisher:{}}]}).counts.invalid,1);
});
test('no evidence is never certified',()=>{
 assert.equal(reconcile({evidence:[],external:[article]}).certified,false);
});
