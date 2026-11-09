import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateNewsReaction as calculate,NEWS_REACTION_METHOD} from '../lib/market/news-reaction-engine';
import {latestNewsReactionWithDependencies as reaction} from '../lib/market/newsReaction';
import {observedNewsFactorsWithDependencies as watchlist} from '../lib/research/news-factor-evidence';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import type {Bar} from '../lib/market/features';
import type {NewsSignal} from '../lib/market/types';
const article='2030-01-02T15:02:00Z',asOf='2030-01-02T15:17:00Z';
const bar=(t:string,c=100):Bar=>({t,o:c,h:c+1,l:c-1,c,v:100});
const rows=[bar('2030-01-02T14:55:00Z',100),bar('2030-01-02T15:00:00Z',500),bar('2030-01-02T15:05:00Z',102),bar('2030-01-02T15:10:00Z',103),bar('2030-01-02T15:15:00Z',999)];
const news=(extra:Partial<NewsSignal>={}):NewsSignal=>({id:'fixture:1',timestamp:article,headline:'Synthetic report',symbols:['TEST'],source:'Fixture',sourceQuality:.8,novelty:1,marketImpact:.5,priceConfirmed:false,summary:'',...extra});
test('return uses latest completed pre-news baseline and fully post-news endpoint, excluding straddling/forming bars',()=>{
 const r=calculate(rows,article,asOf);assert.equal(r.status,'MEASURED');if(r.status!=='MEASURED')return;
 assert.equal(r.baseline.barAt,rows[0].t);assert.equal(r.baseline.closedAt,'2030-01-02T15:00:00.000Z');
 assert.equal(r.endpoint.barAt,rows[3].t);assert.equal(r.endpoint.closedAt,'2030-01-02T15:15:00.000Z');assert.equal(r.returnPct,3);
 assert.equal(r.methodVersion,NEWS_REACTION_METHOD);assert.equal(r.scientificallyCertified,false);
});
test('input permutation and timezone spelling do not select a different return or mutate caller rows',()=>{
 const original=JSON.stringify(rows),a=calculate(rows,article,asOf),b=calculate([...rows].reverse(),article,asOf);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(rows),original);
 const offset=calculate(rows.map(b=>b.t===rows[0].t?{...b,t:'2030-01-02T08:55:00-06:00'}:b),article,asOf);
 assert.equal(offset.status,'MEASURED');if(offset.status==='MEASURED')assert.equal(offset.returnPct,3);
});
test('two pre-news or two post-news bars cannot masquerade as a bracketed reaction',()=>{
 for(const input of [[bar('2030-01-02T14:50:00Z'),rows[0]],[rows[2],rows[3]],[]])assert.equal(calculate(input,article,asOf).status,'UNAVAILABLE');
 assert.equal(calculate([rows[0],rows[2]],article,'2030-01-02T15:09:59.999999999Z').status,'UNAVAILABLE');
 assert.equal(calculate([rows[0],rows[2]],article,'2030-01-02T15:10:00Z').status,'MEASURED');
});
test('malformed or contradictory rows invalidate the response instead of being silently discarded',()=>{
 for(const invalid of [null,{...rows[0],t:'2030-02-30T15:00:00Z'},{...rows[0],t:'2030-01-02T14:55:00.000001Z'},{...rows[0],c:NaN},{...rows[0],c:Infinity},{...rows[0],c:0},{...rows[0],h:99},{...rows[0],v:-1}])assert.equal(calculate([...rows,invalid],article,asOf).status,'UNAVAILABLE');
 assert.equal(calculate([...rows,{...rows[0],t:'2030-01-02T08:55:00-06:00'}],article,asOf).status,'UNAVAILABLE');
 assert.equal(calculate([...rows,bar('2030-01-02T15:20:00Z')],article,asOf).status,'UNAVAILABLE');
});
test('overflow, capped input and invalid decision clocks produce unavailable, never a clamped score',()=>{
 const tiny={t:rows[0].t,o:1e-308,h:1e-308,l:1e-308,c:1e-308,v:1},large={t:rows[2].t,o:1e308,h:1e308,l:1e308,c:1e308,v:1};
 assert.equal(calculate([tiny,large],article,asOf).status,'UNAVAILABLE');
 assert.equal(calculate(Array(1000).fill(rows[0]),article,asOf).status,'UNAVAILABLE');
 for(const clock of ['invalid','2030-01-02','2030-01-02T15:01:59Z'])assert.equal(calculate(rows,article,clock).status,'UNAVAILABLE');
});
test('the 120-minute bound applies to completed interval ends, not bar labels',()=>{
 const r=calculate([rows[0],bar('2030-01-02T16:55:00Z',104),bar('2030-01-02T17:00:00Z',900)],article,'2030-01-02T17:10:00Z');
 assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.equal(r.endpoint.closedAt,'2030-01-02T17:00:00.000Z');assert.equal(r.returnPct,4);}
});
test('actual reaction orchestration requests bounded strict history and carries replayable endpoints into evidence',async()=>{
 let clock=0;
 const r=await reaction('TEST',{news:async()=>({news:[news()],errors:[]}),bars:async(...args)=>{
  assert.deepEqual(args,['TEST','5Min','2030-01-02T14:52:00.000Z',1000,'iex','2030-01-02T15:17:00.000Z',true,true]);return rows;
 },clock:()=>new Date(clock++?'2030-01-02T15:18:00Z':asOf)});
 assert.equal(r.matched,true);assert.equal(r.measuredThrough,'2030-01-02T15:15:00.000Z');assert.equal(r.reactionEvidence?.feed,'iex');
 const result=await watchlist(['TEST'],{news:async()=>({news:[news()],errors:[]}),reaction:async()=>r,clock:()=>new Date('2030-01-02T15:19:00Z')},new Date(asOf));
 const e=result.candidates.find(e=>e.factor==='news_price_reaction')!;assert.equal(e.value,3);assert.equal(e.observedAt,r.measuredThrough);
 const proof=e.metadata?.reactionEvidence as any;assert.equal(proof.baseline.close,100);assert.equal(proof.endpoint.close,103);assert.equal(proof.scientificallyCertified,false);
 assert.equal((await persistEvidenceWithSql(async()=>[{id:'synthetic'}],[e],new Date(result.retrievedAt))).saved,1);
});
test('unrelated, multi-issuer, future and stale news cannot establish a company reaction',async()=>{
 let calls=0;
 const r=await reaction('TEST',{news:async()=>({news:[news({symbols:['OTHER']}),news({symbols:['TEST','OTHER']}),news({timestamp:'2030-01-02T15:18:00Z'}),news({timestamp:'2029-12-30T15:02:00Z'})],errors:[]}),bars:async()=>{calls++;return rows;},clock:()=>new Date(asOf)});
 assert.equal(calls,0);assert.equal(r.matched,false);assert.equal(r.returnPct,null);
});
test('request failures remain unavailable and only three eligible articles may consume history requests',async()=>{
 let calls=0;
 const r=await reaction('TEST',{news:async()=>({news:Array.from({length:5},(_,i)=>news({id:String(i)})),errors:[]}),bars:async()=>{calls++;throw Error('synthetic');},clock:()=>new Date(asOf)});
 assert.equal(calls,3);assert.equal(r.matched,false);assert.equal(r.returnPct,null);
});
test('a backwards completion clock fails closed rather than stamping a backdated result',async()=>{
 let calls=0;
 await assert.rejects(reaction('TEST',{news:async()=>({news:[news()],errors:[]}),bars:async()=>rows,clock:()=>new Date(calls++?'2030-01-02T15:16:00Z':asOf)}),/clock moved backwards/);
});
