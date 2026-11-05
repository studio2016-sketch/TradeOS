import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {compareIexCapturedSessions,IEX_2026_REGULAR_SCHEDULE} from '../lib/research/iex-session-comparison.ts';
import {createRiskReplayBundle} from '../lib/research/risk-replay-bundle.ts';
import {synchronizedRiskStatistics} from '../lib/research/synchronized-risk-statistics.ts';
function weekdays(start:string,end:string,closed:string[]=[]){
 const result:string[]=[];
 for(let t=Date.parse(start+'T00:00:00Z');t<=Date.parse(end+'T00:00:00Z');t+=86400000){const d=new Date(t),s=d.toISOString().slice(0,10);if(![0,6].includes(d.getUTCDay())&&!closed.includes(s))result.push(s);}
 return result;
}
function row(dates=weekdays('2026-08-11','2026-11-04',['2026-09-07']),feed='iex'){
 const sessions=dates.length-1,factor=sessions===60?'beta':'rolling_correlation';
 const bars=dates.map((d,i)=>({t:d+'T05:00:00.000Z',c:100+i+(i%3)}));
 const r=synchronizedRiskStatistics(bars,bars,sessions)!;
 const x={factor,subject:'NVDA',source:`Alpaca:${feed}:1Day`,value:factor==='beta'?r.beta!:r.correlation!,observedAt:r.observedAt,availableAt:'2026-12-31T23:00:00.000Z'};
 const b=createRiskReplayBundle(x,r.inputWindow,{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed});
 return {factor_key:factor,subject:x.subject,source_name:x.source,value:x.value,observed_at:x.observedAt,available_at:x.availableAt,source_metadata:{riskReplay:b}};
}
test('official IEX regular-calendar transcription preserves full holidays and early-close sessions',()=>{
 assert.deepEqual(IEX_2026_REGULAR_SCHEDULE.fullClosures,['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25']);
 assert.deepEqual(IEX_2026_REGULAR_SCHEDULE.earlyCloses,['2026-11-27','2026-12-24']);
 assert.equal(IEX_2026_REGULAR_SCHEDULE.sourcePublishedAt,null);
});
test('61 and21 real-window dates match regular schedule without certification',()=>{
 for(const dates of [weekdays('2026-08-11','2026-11-04',['2026-09-07']),weekdays('2026-10-07','2026-11-04')]){
  const x=row(dates),before=JSON.stringify(x),r=compareIexCapturedSessions(x);
  assert.equal(r.status,'REGULAR_SCHEDULE_MATCH');assert.equal('expectedCount' in r&&r.expectedCount,dates.length);
  assert.equal(r.feedCompletenessCertified,false);assert.equal(r.sourceTimeCertified,false);assert.equal(r.independentReplayVerified,false);assert.equal(r.liveExecutionAllowed,false);assert.equal(JSON.stringify(x),before);
 }
});
test('missing date from BOTH legs is detected despite equal paired dates and full numeric count',()=>{
 const dates=weekdays('2026-08-10','2026-11-04',['2026-09-07','2026-10-12']);assert.equal(dates.length,61);
 const r=compareIexCapturedSessions(row(dates));assert.equal(r.status,'REGULAR_SCHEDULE_DEVIATION');
 assert.deepEqual('legs' in r&&r.legs.own.missingScheduledDates,['2026-10-12']);assert.deepEqual('legs' in r&&r.legs.benchmark.missingScheduledDates,['2026-10-12']);
});
test('weekend substitution reports both unexpected and missing scheduled dates',()=>{
 const dates=weekdays('2026-10-07','2026-11-04').filter(d=>d!=='2026-10-12');dates.push('2026-10-10');dates.sort();
 const r=compareIexCapturedSessions(row(dates));assert.equal(r.status,'REGULAR_SCHEDULE_DEVIATION');
 assert.deepEqual('legs' in r&&r.legs.own.unexpectedDates,['2026-10-10']);assert.deepEqual('legs' in r&&r.legs.own.missingScheduledDates,['2026-10-12']);
});
test('early close dates remain required observations',()=>{
 for(const end of ['2026-11-27','2026-12-24']){
  const dates=weekdays('2026-10-01',end,['2026-11-26']).slice(-21);
  assert.equal(dates.at(-1),end);assert.equal(compareIexCapturedSessions(row(dates)).status,'REGULAR_SCHEDULE_MATCH');
 }
});
test('unknown feed, uncovered year and legacy/corrupt evidence cannot match',()=>{
 assert.equal(compareIexCapturedSessions(row(undefined,'sip')).status,'UNVERIFIED');
 assert.equal(compareIexCapturedSessions(row(weekdays('2025-12-01','2025-12-29'))).status,'UNVERIFIED');
 assert.equal(compareIexCapturedSessions({}).status,'UNVERIFIED');
 const x=row();x.source_metadata.riskReplay.sha256='bad';assert.equal(compareIexCapturedSessions(x).status,'UNVERIFIED');
});
test('receipt time does not imply freshness, historical calendar publication or external completeness',()=>{
 const x=row(),r=compareIexCapturedSessions(x);
 assert.equal(r.status,'REGULAR_SCHEDULE_MATCH');assert.equal('intervalEnd' in r&&r.intervalEnd,'2026-11-04');
 assert.equal('scope' in r&&r.scope,'CAPTURED_ENDPOINT_INTERVAL_ONLY');assert.equal(r.sourceTimeCertified,false);
});
test('offline CLI handles valid, empty and mixed cohorts with research-only output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'iex-sessions-')),file=join(dir,'rows.json');
 try{for(const [rows,status] of [[[row()],0],[[],1],[[row(),{}],1]] as const){
  writeFileSync(file,JSON.stringify(rows));const run=spawnSync(process.execPath,['--import','tsx','scripts/check-risk-sessions.ts',file],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(run.status,status,run.stderr);assert.equal(JSON.parse(run.stdout).certified,false);
 }}finally{rmSync(dir,{recursive:true,force:true});}
});

test('calendar comparison uses New York dates rather than blindly using UTC date labels',()=>{
 const dates=weekdays('2026-10-07','2026-11-04');
 // Midnight UTC belongs to the prior New York date. Production UTC pairing
 // still accepts this synthetic input, but the exchange-calendar comparison differs.
 const bars=dates.map((d,i)=>({t:d+'T00:00:00.000Z',c:100+i+(i%3)}));
 const risk=synchronizedRiskStatistics(bars,bars,20)!;
 const x={factor:'rolling_correlation',subject:'NVDA',source:'Alpaca:iex:1Day',value:risk.correlation!,observedAt:risk.observedAt,availableAt:'2026-12-31T23:00:00.000Z'};
 const b=createRiskReplayBundle(x,risk.inputWindow,{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed:'iex'});
 const result=compareIexCapturedSessions({factor_key:x.factor,subject:x.subject,source_name:x.source,value:x.value,observed_at:x.observedAt,available_at:x.availableAt,source_metadata:{riskReplay:b}});
 assert.equal(result.status,'REGULAR_SCHEDULE_DEVIATION');
 assert.equal('intervalStart' in result&&result.intervalStart,'2026-10-06');
 assert.ok('legs' in result&&result.legs.own.unexpectedDates.includes('2026-10-11'));
});

test('UTC-paired inputs with duplicate local sessions or differing local leg dates fail closed',()=>{
 for(const pairMismatch of [false,true]){
  const x=row(weekdays('2026-10-07','2026-11-04')),p=x.source_metadata.riskReplay.payload;
  if(pairMismatch){p.inputWindow.own[0].t=p.inputWindow.own[0].t.replace('T05:','T00:');}
  else {for(const leg of ['own','benchmark'])p.inputWindow[leg][1].t=p.inputWindow[leg][1].t.replace('T05:','T00:');}
  x.source_metadata.riskReplay=createRiskReplayBundle(p.row,p.inputWindow,p.identity);
  const r=compareIexCapturedSessions(x);
  assert.equal(r.status,'UNVERIFIED');
  assert.equal('reason' in r&&r.reason,pairMismatch?'EXCHANGE_SESSION_DATE_PAIR_MISMATCH':'INVALID_EXCHANGE_SESSION_SEQUENCE');
 }
});
