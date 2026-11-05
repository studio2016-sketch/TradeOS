import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observedPaperQuote} from '../lib/paper/observedQuote.ts';
import {simulatePaperBuy} from '../lib/paper/simulator.ts';
const now=Date.parse('2026-11-05T16:00:00Z');
const base={symbol:'SPY',bid:99,ask:100,source:'Alpaca:iex',quoteTimestamp:'2026-11-05T15:59:50Z',timestamp:'2026-11-05T16:00:00Z'};
test('recent trade cannot verify stale, missing, malformed or future bid/ask',()=>{
 for(const quoteTimestamp of [undefined,'invalid','2026-11-05T15:58:59Z','2026-11-05T16:00:01Z'])assert.equal(observedPaperQuote({...base,quoteTimestamp},'SPY',now),null);
});
test('paper execution retains quote time independently of trade time',()=>{
 const snapshot={...base,timestamp:'2026-11-04T16:00:00Z'};
 const result=observedPaperQuote(snapshot,'SPY',now)!;
 assert.equal(result.ageMs,10000);assert.equal(result.quote.observedAt,base.quoteTimestamp);
 const fill=simulatePaperBuy({side:'buy',symbol:'SPY',quantity:1,limitPrice:100,stopPrice:98,targetPrice:104,maxRisk:2},result.quote,now);
 assert.equal(fill.status,'filled');assert.equal(fill.sourceTime,base.quoteTimestamp);
});
test('quote guard rejects mismatched symbol, bad prices/source/clock and enforces one-minute boundary',()=>{
 assert.equal(observedPaperQuote(base,'QQQ',now),null);
 for(const override of [{bid:NaN},{ask:Infinity},{bid:0},{ask:98},{source:''}])assert.equal(observedPaperQuote({...base,...override},'SPY',now),null);
 assert.equal(observedPaperQuote(base,'SPY',NaN),null);
 assert.ok(observedPaperQuote({...base,quoteTimestamp:'2026-11-05T15:59:00Z'},'SPY',now));
});
test('paper route passes validated quote/time and never labels trade time as quote time',()=>{
 const source=readFileSync(new URL('../app/api/research-paper/route.ts',import.meta.url),'utf8');
 assert.match(source,/observedPaperQuote\(s,symbol\)/);
 assert.match(source,/quote:observed\?\.quote\?\?null/);
 assert.match(source,/marketAgeMs:observed\?\.ageMs\?\?null/);
 assert.match(source,/quoteTime:s\?\.quoteTimestamp\|\|null/);
 assert.doesNotMatch(source,/s\.timestamp|s\?\.timestamp/);
});
