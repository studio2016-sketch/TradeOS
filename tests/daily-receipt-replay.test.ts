import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {dailyCollectionPlan,runDailyFactorCollection,isPinnedSession,pinnedSessionClose} from '../lib/research/daily-factor-collection';
import {replayDailyReceipt,restoreLegacyDailyInput,LEGACY_DAILY_INPUT_SERIALIZATION} from '../lib/research/daily-receipt-replay';
const now=new Date('2026-11-17T22:00:00Z'),plan=dailyCollectionPlan(now);
async function fixture(){
 const bars:{timestamp:string;open:number;high:number;low:number;close:number;volume:number}[]=[];
 for(let day='2026-01-02';day<=plan.session;day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))if(isPinnedSession(day)){
  const c:number=100+bars.length*.1+Math.sin(bars.length);bars.push({timestamp:day+(pinnedSessionClose(day).includes('T20:')?'T04:00:00Z':'T05:00:00Z'),open:c,high:c+1,low:c-1,close:c,volume:1000+bars.length});
 }
 let candidate:any;
 await runDailyFactorCollection({clock:()=>now,claim:async()=>true,history:async()=>({source:'Alpaca:iex',bars}),finish:async(_p,result)=>{candidate=result;return result.evidence.length;}},true);
 return {claim:{session:plan.session,policy:plan.policy,started_at:plan.startedAt,expires_at:plan.expiresAt},completion:{session:plan.session,saved:72,details:candidate.details},evidence:candidate.evidence.map((e:any,i:number)=>({
  id:i+1,factor_key:e.factor,domain:e.domain,subject:e.subject,value:e.value,source_name:e.source,observed_at:e.observedAt,available_at:e.availableAt,
  source_metadata:{...e.metadata,evidenceIntake:{observedAt:e.observedAt,availableAt:e.availableAt,policyVersion:'tradeos.evidence-intake.v2',persistenceTimePolicy:'tradeos.evidence-persistence.microseconds.v1'}}
 }))};
}
test('actual PostgreSQL JSONB key reordering replays legacy hashes and all72 values without mutation',async()=>{
 const input=await fixture(),before=JSON.stringify(input),pg=new PGlite();
 try{
  const stored=(await pg.query<any>('select $1::jsonb receipt',[before])).rows[0].receipt;
  const h=stored.completion.details.histories.NVDA;
  assert.notEqual(createHash('sha256').update(JSON.stringify(h.bars)).digest('hex'),h.inputSha256,'regression must reproduce raw JSONB hash mismatch');
  const frozen=JSON.stringify(stored),result=replayDailyReceipt(stored);
  assert.equal(result.status,'PASS');if(result.status!=='PASS')return;
  assert.equal(result.verifiedIdentities,72);assert.equal(result.newlySaved,72);assert.equal(result.ordersAllowed,false);assert.equal(result.certified,false);
  assert.deepEqual(result.symbols.map(x=>x.factors),[24,24,24]);assert.equal(JSON.stringify(stored),frozen);assert.equal(JSON.stringify(input),before);
  assert.equal(createHash('sha256').update(JSON.stringify(restoreLegacyDailyInput(h.bars))).digest('hex'),h.inputSha256);
 }finally{await pg.close();}
});
test('versioned replay supports only the explicit original serialization and never rewrites timestamps or values',async()=>{
 const r=await fixture();for(const h of Object.values(r.completion.details.histories) as any[])h.inputSerializationVersion=LEGACY_DAILY_INPUT_SERIALIZATION;
 assert.equal(replayDailyReceipt(r).status,'PASS');
 r.completion.details.histories.NVDA.inputSerializationVersion='future-unreviewed';
 assert.equal((replayDailyReceipt(r) as any).reason,'unsupported_serialization');
 const bars=(await fixture()).completion.details.histories.NVDA.bars;
 assert.throws(()=>restoreLegacyDailyInput([...bars].reverse()),/history_invalid/);
 assert.throws(()=>restoreLegacyDailyInput(bars.map((b:any)=>({...b,secretExtra:1}))),/history_invalid/);
 const reordered=bars.map((b:any)=>({volume:b.volume,close:b.close,low:b.low,high:b.high,open:b.open,timestamp:b.timestamp}));
 assert.deepEqual(restoreLegacyDailyInput(reordered),bars);
});
test('tampered rows, input hashes, identity coverage, claims and authority flags fail closed',async()=>{
 const edits:[string,(r:any)=>void][]=[
  ['history symbol',r=>r.completion.details.histories.NVDA.symbol='AMD'],
  ['history missing',r=>r.completion.details.histories.NVDA.missing={sma_5:'failed'}],
  ['null error',r=>r.completion.details.histories.NVDA.error=null],
  ['false error',r=>r.completion.details.histories.NVDA.error=false],
  ['empty error',r=>r.completion.details.histories.NVDA.error=''],
  ['history extra',r=>r.completion.details.histories.NVDA.unknownField=true],
  ['intake extra',r=>r.evidence[0].source_metadata.evidenceIntake.unknownField=true],
  ['value',r=>r.evidence[0].value+=.01],['hash',r=>r.completion.details.histories.NVDA.inputSha256='0'.repeat(64)],
  ['input',r=>r.completion.details.histories.NVDA.bars.at(-1).close+=.01],['duplicate',r=>r.evidence[1]=r.evidence[0]],
  ['missing',r=>r.evidence.pop()],['extra',r=>r.evidence.push(r.evidence[0])],['wrong symbol',r=>r.evidence[0].subject='SPY'],
  ['source',r=>r.evidence[0].source_name='Alpaca:sip'],['metadata',r=>r.evidence[0].source_metadata.executionAllowed=true],
  ['authority',r=>r.completion.details.scientificallyCertified=true],['synthetic',r=>r.completion.details.syntheticFixture=true],
  ['session',r=>r.claim.session='2026-11-16'],['saved',r=>r.completion.saved=73],['saved type',r=>r.completion.saved='72'],
  ['receipt future',r=>r.completion.details.histories.NVDA.retrievedAt='2026-11-17T23:00:00Z'],
  ['availability',r=>r.evidence[0].available_at='2026-11-17T22:00:00.000001Z'],
  ['intake',r=>r.evidence[0].source_metadata.evidenceIntake.policyVersion='future-version'],
 ];
 for(const [name,edit] of edits){const r=await fixture();edit(r);const result=replayDailyReceipt(r);assert.equal(result.status,'FAIL',name);assert.equal(result.ordersAllowed,false);assert.equal(result.certified,false);}
 for(const value of [null,[],{},'private-error-text'])assert.equal(replayDailyReceipt(value).status,'FAIL');
});
test('identical existing identities do not falsely claim72 newly inserted rows',async()=>{
 const r=await fixture();r.completion.saved=0;const result=replayDailyReceipt(r);assert.equal(result.status,'PASS');if(result.status==='PASS'){assert.equal(result.newlySaved,0);assert.equal(result.verifiedIdentities,72);}
});

test('frozen synthetic legacy values and digest detect silent serialization or calculation changes',async()=>{
 const r=await fixture(),golden=JSON.parse(readFileSync(new URL('./fixtures/daily-replay-v0-golden.json',import.meta.url),'utf8'));
 assert.equal(r.completion.details.histories.NVDA.inputSha256,golden.hash);
 assert.deepEqual(Object.fromEntries(r.evidence.filter((e:any)=>e.subject==='NVDA').map((e:any)=>[e.factor_key,e.value])),golden.values);
});
test('CLI verifies stdin snapshots without a database and sanitizes malformed input',async()=>{
 const invoke=(input:string)=>spawnSync(process.execPath,['--import','tsx','scripts/verify-daily-receipt.ts'],{input,encoding:'utf8',env:{...process.env,DATABASE_URL:'not-a-connection',ALPACA_API_KEY:'',ALPACA_API_SECRET:''}});
 const ok=invoke(JSON.stringify(await fixture()));assert.equal(ok.status,0,ok.stderr);assert.equal(JSON.parse(ok.stdout).status,'PASS');
 for(const input of ['private-secret-invalid-json','x'.repeat(2_000_001)]){
  const bad=invoke(input);assert.equal(bad.status,1);const result=JSON.parse(bad.stdout);assert.equal(result.status,'FAIL');assert.ok(!bad.stdout.includes('private-secret'));assert.equal(bad.stderr,'');
 }
});
