import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalCandidate} from '../lib/research/acceleration-replay';

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
