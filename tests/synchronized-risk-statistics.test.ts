import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronizedRiskStatistics} from '../lib/research/synchronized-risk-statistics.ts';
const bars=(returns:number[],hour='05')=>{
 let c=100;
 return [0,...returns].map((r,i)=>{if(i)c*=1+r;return {t:`2026-10-${String(i+1).padStart(2,'0')}T${hour}:00:00Z`,c};});
};
const near=(actual:number|null|undefined,expected:number)=>assert.ok(actual!=null&&Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
test('independent covariance and Pearson result, exact sample count and latest input timestamp',()=>{
 // x=[.1,.2,0], y=[.05,.1,-.05]; covariance sum=.015,
 // benchmark variance sum=7/600, own variance sum=.02.
 const result=synchronizedRiskStatistics(bars([.1,.2,0]),bars([.05,.1,-.05],'06'),3)!;
 near(result.beta,9/7);near(result.correlation,.015/Math.sqrt(.02*(7/600)));
 assert.equal(result.sampleCount,3);assert.equal(result.sessionDates.length,4);
 assert.equal(result.observedAt,'2026-10-04T06:00:00.000Z');
});
test('rejects unequal intervals even when return ending dates overlap',()=>{
 const a=bars(Array(22).fill(.01)),b=a.filter((_,i)=>i!==10);
 assert.equal(synchronizedRiskStatistics(a,b,20),null);
 assert.equal(synchronizedRiskStatistics(a,a.slice(0,-1),20),null);
 assert.equal(synchronizedRiskStatistics(a.slice(0,20),a.slice(0,20),20),null);
});
test('sorts without mutation and rejects duplicate dates and invalid prices or timestamps',()=>{
 const a=bars([.1,.2,0]),reverse=[...a].reverse();
 near(synchronizedRiskStatistics(reverse,a,3)?.beta,1);assert.equal(reverse[0],a[3]);
 for(const bad of [0,-1,NaN,Infinity]){const b=a.map(x=>({...x}));b[1].c=bad;assert.equal(synchronizedRiskStatistics(a,b,3),null);}
 const duplicate=a.map(x=>({...x}));duplicate[1].t=duplicate[0].t;
 assert.equal(synchronizedRiskStatistics(a,duplicate,3),null);
 const invalid=a.map(x=>({...x}));invalid[1].t='invalid';assert.equal(synchronizedRiskStatistics(a,invalid,3),null);
 for(const n of [0,1,1.5,NaN])assert.equal(synchronizedRiskStatistics(a,a,n),null);
});
test('handles zero variance, negative correlation and overflow without inventing values',()=>{
 const zero=bars([0,0,0]),varied=bars([.1,-.1,.2]);
 assert.equal(synchronizedRiskStatistics(varied,zero,3)?.beta,null);
 assert.equal(synchronizedRiskStatistics(varied,zero,3)?.correlation,null);
 near(synchronizedRiskStatistics(zero,varied,3)?.beta,0);
 assert.equal(synchronizedRiskStatistics(zero,varied,3)?.correlation,null);
 near(synchronizedRiskStatistics(bars([-.1,.1,-.2]),varied,3)?.correlation,-1);
 const extreme=bars([0,0,0]);extreme[0].c=Number.MIN_VALUE;extreme[1].c=Number.MAX_VALUE;
 assert.equal(synchronizedRiskStatistics(extreme,varied,3),null);
});
