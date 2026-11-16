import test from 'node:test';
import assert from 'node:assert/strict';
import {observedIntradayActivationEvidenceWithDependencies as collect,INTRADAY_AVAILABILITY_VERSION} from '../lib/research/intraday-activation-evidence';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import {auditEvidence} from '../lib/research/source-vintage-audit';
import type {Bar} from '../lib/market/features';
const requested=new Date('2030-02-01T16:00:00Z');
const completed='2030-02-01T16:00:04.000Z';
const bar=(t:string,c=100,n=10):Bar=>({t,c,n,o:c,h:c+1,l:c-1,v:1000});
const intraday=[bar('2030-02-01T14:58:00Z'),bar('2030-02-01T15:43:00Z'),bar('2030-02-01T15:53:00Z'),bar('2030-02-01T15:57:00Z'),bar('2030-02-01T15:58:00Z',102)];
type Deps=Parameters<typeof collect>[0];
function fixtures(overrides:Partial<Deps>={}){
 let calls=0;
 const deps:Deps={
  history:async(_symbol,timeframe)=>timeframe==='1Day'?[bar('2030-01-31T05:00:00Z')]:intraday,
  fundamentals:async()=>({symbol:'NVDA',status:'ok',values:{shares:10000},provenance:{shares:{end:'2030-01-01',filed:'2030-01-15',accession:'fixture:filing'}},retrievedAt:requested.toISOString()} as Awaited<ReturnType<Deps['fundamentals']>>),
  quote:async()=>[{source_id:'Alpaca:iex',event_time:'2030-02-01T15:59:00Z',metadata:{bid:100,ask:101,quoteTimestamp:'2030-02-01T15:59:00.123456Z'}}],
  clock:()=>new Date(requested.getTime()+1000*++calls),...overrides
 };
 return deps;
}
test('all evidence availability is after the last awaited dependency and extraction',async()=>{
 const stages:string[]=[];const deps=fixtures();
 const data=await collect({...deps,
  history:async(...args)=>{await Promise.resolve();stages.push(args[1]);return deps.history(...args);},
  fundamentals:async(...args)=>{await Promise.resolve();stages.push('SEC');return deps.fundamentals(...args);},
  quote:async()=>{await Promise.resolve();stages.push('quote');return deps.quote();},
  clock:()=>{const expected=[['1Min'],['1Min','1Min'],['1Min','1Min','SEC','1Day'],['1Min','1Min','SEC','1Day','quote']];
   assert.deepEqual(stages,expected[[1,2,4,5].indexOf(stages.length)]);return deps.clock();}
 },requested);
 assert.equal(data.requestedAt,requested.toISOString());assert.equal(data.retrievedAt,completed);
 assert.equal(data.candidates.length,12);
 for(const e of data.candidates){
  assert.equal(e.availableAt,completed);assert.equal(e.metadata?.requestedAt,requested.toISOString());
  assert.equal(e.metadata?.availabilityKind,'extraction_completed');assert.equal(e.metadata?.availabilityVersion,INTRADAY_AVAILABILITY_VERSION);
 }
 assert.equal(auditEvidence(data.candidates,'2030-02-01T16:00:03.999999999Z').measured,0);
 assert.ok(auditEvidence(data.candidates,completed).measured>0);
});
test('original source timestamps, arithmetic and history/SEC query cutoffs stay unchanged',async()=>{
 const calls:unknown[][]=[];const deps=fixtures();
 const data=await collect({...deps,history:async(...args)=>{calls.push(args);return deps.history(...args);},fundamentals:async(...args)=>{assert.deepEqual(args,['NVDA',requested.toISOString()]);return deps.fundamentals(...args);}},requested);
 assert.equal(calls.length,3);assert.ok(calls.every(args=>args[5]==='2030-02-01T15:58:00.000Z'));
 assert.equal(data.candidates.find(e=>e.factor==='return_1m')?.observedAt,'2030-02-01T15:58:00Z');
 assert.equal(data.candidates.find(e=>e.factor==='turnover')?.value,.1);
 assert.equal(data.candidates.find(e=>e.factor==='turnover')?.observedAt,'2030-01-31T05:00:00Z');
 assert.equal(data.candidates.find(e=>e.factor==='slippage_estimate')?.observedAt,'2030-02-01T15:59:00.123456Z');
});
test('persisted intake metadata retains the completion time rather than request time',async()=>{
 const data=await collect(fixtures(),requested);const inserts:unknown[][]=[];
 const stored=await persistEvidenceWithSql(async(_s:TemplateStringsArray,...v:unknown[])=>{inserts.push(v);return[{id:'fixture'}];},data.candidates,new Date(completed));
 assert.equal(stored.saved,12);assert.deepEqual(stored.rejected,[]);
 for(const values of inserts){assert.equal(values[6],completed);assert.equal(JSON.parse(values[7] as string).evidenceIntake.availableAt,completed);}
});
test('quote observed during the request can be stored, but never enter an earlier decision',async()=>{
 const data=await collect(fixtures({quote:async()=>[{source_id:'Alpaca:iex',event_time:completed,metadata:{bid:100,ask:101,quoteTimestamp:'2030-02-01T16:00:03.123456Z'}}]}),requested);
 const quote=data.candidates.find(e=>e.factor==='slippage_estimate')!;
 const stored=await persistEvidenceWithSql(async()=>[{id:'fixture'}],[quote],new Date(completed));
 assert.equal(stored.saved,1);assert.equal(auditEvidence([quote],'2030-02-01T16:00:03.999999Z').measured,0);
});
test('partial source failures preserve successful evidence with final completion time',async()=>{
 const deps=fixtures();const data=await collect({...deps,history:async(...args)=>{if(args[0]==='NVDA')throw Error('synthetic source failure');return deps.history(...args);},quote:async()=>{throw Error('synthetic quote failure');}},requested);
 assert.equal(data.candidates.length,5);assert.equal(data.diagnostics.length,4);
 assert.ok(data.candidates.every(e=>e.availableAt===completed));
});
test('invalid request clock fails before any source read',async()=>{
 const fail=async()=>assert.fail('invalid clock must not start collection');
 await assert.rejects(collect(fixtures({history:fail,fundamentals:fail,quote:fail}),new Date(NaN)),/Invalid intraday request clock/);
});
test('invalid and backwards clocks abort before evidence is returned',async()=>{
 for(const clocks of [[-1],[1000,999],[1000,2000,1999],[1000,2000,3000,2999],[1000,NaN]]){
  let i=0;await assert.rejects(collect(fixtures({clock:()=>new Date(requested.getTime()+clocks[Math.min(i++,clocks.length-1)])}),requested),/clock/);
 }
});
test('equal monotonic clock values are accepted and empty sources cannot invent evidence',async()=>{
 const data=await collect(fixtures({history:async()=>[],fundamentals:async()=>{throw Error('no facts');},quote:async()=>[],clock:()=>requested}),requested);
 assert.deepEqual(data.candidates,[]);assert.equal(data.retrievedAt,requested.toISOString());
});
test('nonrepresentable source nanoseconds remain exact and rejected by the unchanged storage guard',async()=>{
 const stamp='2030-02-01T15:59:00.123456789Z';
 const data=await collect(fixtures({quote:async()=>[{source_id:'Alpaca:iex',event_time:stamp,metadata:{bid:100,ask:101,quoteTimestamp:stamp}}]}),requested);
 const quote=data.candidates.find(e=>e.factor==='slippage_estimate')!;assert.equal(quote.observedAt,stamp);
 const stored=await persistEvidenceWithSql(async()=>assert.fail('lossy timestamp cannot be inserted'),[quote],new Date(completed));
 assert.deepEqual(stored.rejected[0].reasons,['unsupported_storage_precision']);
});

test('missing or malformed quote clocks never inherit the trade event clock',async()=>{
 for(const quoteTimestamp of [undefined,null,'','2030-02-30T15:59:00Z','2030-02-01','2030-02-01T15:59:00',42]){
  const data=await collect(fixtures({quote:async()=>[{source_id:'Alpaca:iex',event_time:'2030-02-01T15:59:00Z',metadata:{bid:100,ask:101,quoteTimestamp}}]}),requested);
  assert.equal(data.candidates.some(e=>e.factor==='slippage_estimate'),false);
  assert.ok(data.diagnostics.some(d=>d.slippageError==='missing_or_invalid_quote_timestamp'));
  assert.equal(data.candidates.length,11);
 }
});
test('quote prices must be numeric observations rather than coercible input',async()=>{
 for(const bid of [true,'100',[],{},null,NaN,Infinity]){
  const data=await collect(fixtures({quote:async()=>[{source_id:'Alpaca:iex',event_time:'2030-02-01T15:59:00Z',metadata:{bid,ask:101,quoteTimestamp:'2030-02-01T15:59:00Z'}}]}),requested);
  assert.equal(data.candidates.some(e=>e.factor==='slippage_estimate'),false);
  assert.ok(data.diagnostics.some(d=>d.slippageError==='invalid_quote_prices'));
 }
});
test('nanosecond quote rejection does not prevent other evidence in the batch',async()=>{
 const stamp='2030-02-01T15:59:00.123456789Z';
 const data=await collect(fixtures({quote:async()=>[{source_id:'Alpaca:iex',event_time:stamp,metadata:{bid:100,ask:101,quoteTimestamp:stamp}}]}),requested);
 const inserts:unknown[][]=[];
 const result=await persistEvidenceWithSql(async(_s:TemplateStringsArray,...v:unknown[])=>{inserts.push(v);return[{id:'fixture'}];},data.candidates,new Date(completed));
 assert.equal(result.received,12);assert.equal(result.saved,11);
 assert.deepEqual(result.rejected,[{factor:'slippage_estimate',reasons:['unsupported_storage_precision']}]);
 assert.equal(inserts.some(v=>v[0]==='slippage_estimate'),false);
});
