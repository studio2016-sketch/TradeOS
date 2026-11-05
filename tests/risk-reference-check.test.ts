import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRiskReplayBundle} from '../lib/research/risk-replay-bundle.ts';
import {synchronizedRiskStatistics} from '../lib/research/synchronized-risk-statistics.ts';
import {crossCheckCapturedRiskRow,referenceValuesAgree} from '../lib/research/risk-reference-check.ts';
function fixture(factor='beta'){
 const n=factor==='beta'?60:20;
 const own=Array.from({length:n+1},(_,i)=>({t:new Date(Date.UTC(2026,0,1+i)).toISOString(),c:100+i+Math.sin(i)*2}));
 const benchmark=own.map((b,i)=>({...b,c:200+i+Math.cos(i)*3}));
 const risk=synchronizedRiskStatistics(own,benchmark,n)!;
 const row={factor,subject:factor==='equity_bond_correlation'?'SPY_TLT':'NVDA',source:'Alpaca:iex:1Day',value:factor==='beta'?risk.beta!:risk.correlation!,observedAt:risk.observedAt,availableAt:'2026-10-01T00:00:00.123Z'};
 const bundle=createRiskReplayBundle(row,risk.inputWindow,{ownSymbol:factor==='equity_bond_correlation'?'SPY':'NVDA',benchmarkSymbol:factor==='equity_bond_correlation'?'TLT':'SPY',feed:'iex'});
 return {factor_key:factor,subject:row.subject,source_name:row.source,value:row.value,observed_at:row.observedAt.replace('T',' ').replace('Z','+00'),available_at:row.availableAt.replace('T',' ').replace('Z','+00'),source_metadata:{riskReplay:bundle}};
}
test('separate reference agrees with captured production metrics but certifies nothing',()=>{
 for(const factor of ['beta','rolling_correlation','equity_bond_correlation']){
  const result=crossCheckCapturedRiskRow(fixture(factor));
  assert.equal(result.status,'REFERENCE_AGREES');
  assert.equal(result.sourceTimeCertified,false);assert.equal(result.independentReplayVerified,false);assert.equal(result.predictiveCertification,false);assert.equal(result.liveExecutionAllowed,false);
 }
});
test('legacy, detached, corrupt and unknown evidence fails rather than gaining reference status',()=>{
 for(const change of [
  (r:any)=>{delete r.source_metadata;},
  (r:any)=>{r.value+=0.001;},
  (r:any)=>{r.source_metadata.riskReplay.payload.inputWindow.own[0].c+=1;},
  (r:any)=>{r.source_metadata.riskReplay.payload.implementation.sha256='unknown';},
  (r:any)=>{r.observed_at='not a date';},
  (r:any)=>{r.value=String(r.value);},
  (r:any)=>{r.subject='AMD';}
 ]){const row=fixture();change(row);assert.equal(crossCheckCapturedRiskRow(row).status,'UNVERIFIED');}
});
test('predeclared tolerance has absolute and relative bounds, not universal agreement',()=>{
 assert.equal(referenceValuesAgree(0,1e-11),true);
 assert.equal(referenceValuesAgree(0,1e-8),false);
 assert.equal(referenceValuesAgree(100,100+1e-8),true);
 assert.equal(referenceValuesAgree(100,100+1e-5),false);
 assert.equal(referenceValuesAgree(NaN,NaN),false);assert.equal(referenceValuesAgree(Infinity,Infinity),false);
});
test('offline CLI succeeds only for nonempty fully matching exports and never creates evidence',()=>{
 const directory=mkdtempSync(join(tmpdir(),'risk-reference-')),file=join(directory,'rows.json');
 try{
  for(const [rows,expected] of [[[],1],[[fixture()],0],[[fixture(),{}],1]] as const){
   writeFileSync(file,JSON.stringify(rows));
   const run=spawnSync(process.execPath,['--import','tsx','scripts/check-risk-replay.ts',file],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
   assert.equal(run.status,expected,run.stderr);
   const report=JSON.parse(run.stdout);assert.equal(report.certified,false);assert.equal(report.status,'RESEARCH_ONLY');assert.equal(report.rows,rows.length);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('reference can reject a malformed calendar date tolerated by production Date.parse',()=>{
 const bars=Array.from({length:21},(_,i)=>({t:i===0?'2026-02-30T00:00:00Z':new Date(Date.UTC(2026,2,2+i)).toISOString(),c:100+i+(i%3)}));
 const risk=synchronizedRiskStatistics(bars,bars,20)!;
 assert.ok(risk);
 const row={factor:'rolling_correlation',subject:'NVDA',source:'Alpaca:iex:1Day',value:risk.correlation!,observedAt:risk.observedAt,availableAt:'2026-10-01T00:00:00.000Z'};
 const bundle=createRiskReplayBundle(row,risk.inputWindow,{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed:'iex'});
 const result=crossCheckCapturedRiskRow({factor_key:row.factor,subject:row.subject,source_name:row.source,value:row.value,observed_at:row.observedAt,available_at:row.availableAt,source_metadata:{riskReplay:bundle}});
 assert.equal(result.status,'UNVERIFIED');assert.equal(result.reason,'REFERENCE_INPUT_REJECTED');
});

test('ill-conditioned near-constant returns produce an explicit numerical disagreement',()=>{
 // Deterministic stress vector: variance is tiny relative to mean. Do not widen
 // tolerance or rewrite production evidence merely to make two algorithms agree.
 let ownClose=100,benchmarkClose=100;
 const own=[{t:'2026-01-01T00:00:00.000Z',c:ownClose}],benchmark=[{t:'2026-01-01T00:00:00.000Z',c:benchmarkClose}];
 for(let i=1;i<=60;i++){
  const r=.1+1e-14*((i%5)-2);ownClose*=1+2*r+.001;benchmarkClose*=1+r;
  const t=new Date(Date.UTC(2026,0,i+1)).toISOString();own.push({t,c:ownClose});benchmark.push({t,c:benchmarkClose});
 }
 const risk=synchronizedRiskStatistics(own,benchmark,60)!;
 const row={factor:'beta',subject:'NVDA',source:'Alpaca:iex:1Day',value:risk.beta!,observedAt:risk.observedAt,availableAt:'2026-10-01T00:00:00.000Z'};
 const bundle=createRiskReplayBundle(row,risk.inputWindow,{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed:'iex'});
 const result=crossCheckCapturedRiskRow({factor_key:row.factor,subject:row.subject,source_name:row.source,value:row.value,observed_at:row.observedAt,available_at:row.availableAt,source_metadata:{riskReplay:bundle}});
 assert.equal(result.status,'REFERENCE_DISAGREES');
 assert.ok('absoluteDifference' in result&&result.absoluteDifference>1e-7);
 assert.equal(result.independentReplayVerified,false);assert.equal(result.liveExecutionAllowed,false);
});
