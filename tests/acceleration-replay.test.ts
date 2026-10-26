import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalCandidate,validateHistoricalBars} from '../lib/research/acceleration-replay';

test('historical replay requires adequate ordered price history',()=>{
 assert.throws(()=>historicalCandidate(Array(60).fill(100),20,false,5),/Insufficient/);
});
test('flat prices without turnover produce zero mean net',()=>{
 const result=historicalCandidate(Array(140).fill(100),20,false,5);
 assert.equal(result.meanNet,0);
 assert.equal(result.benchmarkMean,0);
});
test('trading costs reduce candidate net return',()=>{
 const prices=Array.from({length:150},(_,i)=>100+i);
 const cheap=historicalCandidate(prices,5,false,5);
 const expensive=historicalCandidate(prices,5,false,20);
 assert.ok(expensive.meanNet<cheap.meanNet);
});
test('candidate replay returns finite metrics',()=>{
 const prices=Array.from({length:160},(_,i)=>100+i*0.1);
 const result=historicalCandidate(prices,10,false,5);
 assert.ok(result.samples>0);
 assert.ok(Number.isFinite(result.meanNet));
 assert.ok(Number.isFinite(result.maxDrawdown));
});

test('stale historical bars cannot create new trial datasets',()=>{
 const bars=Array.from({length:140},(_,i)=>({t:new Date(Date.UTC(2025,0,1+i)).toISOString(),c:100+i}));
 assert.throws(()=>validateHistoricalBars(bars,'2026-10-26T00:00:00Z'),/stale/);
});
test('duplicate timestamps fail closed',()=>{
 const bars=Array.from({length:140},(_,i)=>({t:new Date(Date.UTC(2026,3,1+i)).toISOString(),c:100+i}));
 bars[139].t=bars[138].t;
 assert.throws(()=>validateHistoricalBars(bars,'2026-10-26T00:00:00Z'),/Duplicate/);
});
test('fresh ordered bars use actual last timestamp',()=>{
 const bars=Array.from({length:140},(_,i)=>({t:new Date(Date.UTC(2026,5,8+i)).toISOString(),c:100+i}));
 const result=validateHistoricalBars(bars,'2026-10-26T00:00:00Z');
 assert.ok(result);
 assert.equal(result?.datasetEnd,bars[139].t);
});
