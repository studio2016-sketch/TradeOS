import test from 'node:test';import assert from 'node:assert/strict';
import {advancementCheck,runSessionAudit,type SessionDeps} from '../lib/operations/market-session-audit';
import {strictClock} from '../lib/operations/strict-provider-clock';
const start=Date.parse('2026-11-17T16:00:00Z');const iso=(x:number)=>new Date(x).toISOString();
const clock=(now=start,open=true)=>({timestamp:iso(now),isOpen:open,nextOpen:'2026-11-18T14:30:00Z',nextClose:'2026-11-17T21:00:00Z'});
const market=(now:number)=>({snapshots:['SPY','QQQ'].map(symbol=>({symbol,price:100,source:'Synthetic',timestamp:iso(now)}))});
function fixture(){let now=start;return {deps:{now:()=>now,wait:async(ms:number)=>{assert.equal(ms,90000);now+=ms;},clock:async()=>clock(now),brokerConfigured:async()=>true,market:async()=>market(now),chart:async()=>({symbol:'SPY',points:[{t:iso(now),c:100}],source:'Synthetic'})} satisfies SessionDeps,set:(v:number)=>{now=v;}};}
test('strict provider clock never invents timestamps or coerces open state',()=>{
 const raw={timestamp:iso(start),is_open:false,next_open:iso(start+1000),next_close:iso(start+2000)};assert.ok(strictClock(raw));
 for(const bad of [{...raw,timestamp:undefined},{...raw,is_open:'false'},{...raw,next_open:1},{...raw,timestamp:'2026-02-30T00:00:00Z'}])assert.equal(strictClock(bad),null);
});
test('advancement requires BOTH symbols, same source, exact chronology and actual 90-second separation',async()=>{
 const {deps}=fixture();const r=await runSessionAudit('advancement',deps);assert.ok(Object.values(r.checks).every(x=>x==='PASS'));assert.ok(!JSON.stringify(r).includes('Synthetic'));
 assert.equal(advancementCheck(market(start),market(start+90000),'SPY',start,start+89999),'FAIL');
 assert.equal(advancementCheck(market(start),{snapshots:market(start+90000).snapshots.slice(0,1)},'QQQ',start,start+90000),'UNAVAILABLE');
 const same=market(start);assert.equal(advancementCheck(same,same,'SPY',start,start+90000),'FAIL');
 const switched=market(start+90000);switched.snapshots[0].source='Other';assert.equal(advancementCheck(market(start),switched,'SPY',start,start+90000),'FAIL');
 assert.equal(advancementCheck(market(start),market(start+90001),'SPY',start,start+90000),'FAIL');
 const duplicate=market(start+90000);duplicate.snapshots.push(duplicate.snapshots[0]);assert.equal(advancementCheck(market(start),duplicate,'SPY',start,start+90000),'UNAVAILABLE');
});
test('nanoseconds and timezone equivalence compare numerically, not lexically',()=>{
 const a=market(start),b=market(start+90000);a.snapshots[0].timestamp='2026-11-17T11:00:00.000000001-05:00';b.snapshots[0].timestamp='2026-11-17T16:01:30.000000001Z';
 assert.equal(advancementCheck(a,b,'SPY',start+1,start+90001),'PASS');
});
test('closed market is explicit NOT RUN; missing or stale clock cannot become a skip/pass',async()=>{
 const {deps}=fixture();const closed=await runSessionAudit('advancement',{...deps,clock:async()=>clock(start,false),market:async()=>assert.fail('closed-market provider probe forbidden')});assert.ok(Object.values(closed.checks).every(x=>x==='NOT_RUN_MARKET_CLOSED'));
 for(const value of [null,clock(start-121000),clock(start+1)]){const r=await runSessionAudit('advancement',{...deps,clock:async()=>value,market:async()=>assert.fail('invalid-clock provider probe forbidden')});assert.ok(Object.values(r.checks).every(x=>x==='UNAVAILABLE'));}
});
test('readiness checks future next open while closed and distinguishes unconfigured account reads',async()=>{
 const {deps}=fixture();const r=await runSessionAudit('readiness',{...deps,clock:async()=>({...clock(start,false),nextOpen:iso(start-1)}),brokerConfigured:async()=>false});assert.equal(r.checks.closedMarketNextOpenFuture,'FAIL');assert.equal(r.checks.brokerAccountReadConfigured,'UNAVAILABLE');
});
test('timeout is unavailable and stops new phases after expiry',async()=>{
 const {deps}=fixture();let resume!:()=>void;let marketCalls=0;
 const r=await runSessionAudit('advancement',{...deps,market:async()=>{marketCalls++;return market(start);},wait:()=>new Promise<void>(resolve=>{resume=resolve;})},5);assert.ok(Object.values(r.checks).every(x=>x==='UNAVAILABLE'));resume();await new Promise(r=>setTimeout(r,5));assert.equal(marketCalls,1);
});
test('inconsistent official session boundaries cannot become a verified market-closed skip',async()=>{
 const {deps}=fixture();for(const c of [{...clock(start,false),nextOpen:iso(start-1)},{...clock(start,true),nextClose:iso(start-1)}]){
  const r=await runSessionAudit('advancement',{...deps,clock:async()=>c,market:async()=>assert.fail('inconsistent clock must stop probes')});assert.ok(Object.values(r.checks).every(x=>x==='UNAVAILABLE'));
 }
});
test('strict official clock request never follows redirects with provider credentials',async()=>{
 const {readStrictProviderClock}=await import('../lib/operations/strict-provider-clock');const oldFetch=globalThis.fetch;
 const names=['ALPACA_API_KEY','ALPACA_API_SECRET','ALPACA_TRADING_ENV'] as const;const before=names.map(n=>process.env[n]);
 try{process.env.ALPACA_API_KEY='synthetic-key';process.env.ALPACA_API_SECRET='synthetic-secret';process.env.ALPACA_TRADING_ENV='paper';
  globalThis.fetch=async(input,init)=>{assert.equal(input,'https://paper-api.alpaca.markets/v2/clock');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);throw new TypeError('redirect rejected');};
  assert.equal(await readStrictProviderClock(),null);
 }finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>{if(before[i]===undefined)delete process.env[n];else process.env[n]=before[i];});}
});
