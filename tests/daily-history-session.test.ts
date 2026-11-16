import test from 'node:test';
import assert from 'node:assert/strict';
import {alpacaDailyHistory} from '../lib/research/market-factor-history';
test('explicit completed-session transport admits just-closed daily bars; legacy default excludes current NY day',async()=>{
 const fetchOriginal=globalThis.fetch,env={...process.env};let calls=0;
 try{
  process.env.ALPACA_API_KEY='synthetic-key';process.env.ALPACA_API_SECRET='synthetic-secret';process.env.ALPACA_FEED='iex';
  const bar=(t:string)=>({t,o:100,h:102,l:99,c:101,v:1000});
  let payload:any={symbol:'NVDA',bars:[bar('2026-11-13T05:00:00Z'),bar('2026-11-16T05:00:00Z')]};
  globalThis.fetch=async(input,init)=>{calls++;const url=new URL(String(input));assert.equal(url.searchParams.get('timeframe'),'1Day');assert.equal(url.searchParams.get('limit'),'1000');assert.equal(url.searchParams.get('feed'),'iex');assert.equal(url.searchParams.get('adjustment'),'raw');assert.ok(init?.signal);return Response.json(payload);};
  const now='2026-11-16T22:00:00Z';
  assert.equal((await alpacaDailyHistory('NVDA',now)).bars.length,1);
  assert.equal((await alpacaDailyHistory('NVDA',now,'2026-11-16')).bars.length,2);
  for(const session of ['2026-11-17','2026-02-30','bad'])assert.equal((await alpacaDailyHistory('NVDA',now,session)).error,'invalid_completed_session');
  assert.equal(calls,2);
  for(const [change,error] of [[{next_page_token:'more'},'pagination_incomplete'],[{bars:Array(1001).fill(bar('2026-11-16T05:00:00Z'))},'oversized_history'],[{bars:[bar('2026-11-17T05:00:00Z')]},'future_history']] as const){
   payload={symbol:'NVDA',bars:[],...change};const before:number=calls;
   assert.equal((await alpacaDailyHistory('NVDA',now,'2026-11-16')).error,error);assert.equal(calls-before,1);
  }
 }finally{globalThis.fetch=fetchOriginal;process.env=env;}
});
