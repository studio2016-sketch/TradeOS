import {researchToPaper} from "../lib/paper/researchBridge.ts";
import assert from "node:assert/strict";
import test from "node:test";
const now=Date.parse("2026-10-11T16:00:00Z");
const sample={alignment:{buyState:"READY",canonical:{availability:80},supervisors:{buyVeto:false}},dataProvenance:"verified_observation" as const,marketAgeMs:10000,quote:{symbol:"SPY",bid:99.99,ask:100,observedAt:"2026-10-11T15:59:50Z",source:"TEST"},order:{side:"buy" as const,symbol:"SPY",quantity:2,limitPrice:100,stopPrice:98,targetPrice:104,maxRisk:10},portfolio:{equity:10000,cash:10000,dailyRealizedPnl:0,positions:[],candidate:{symbol:"SPY",sector:"ETF",notional:200,plannedRisk:4},limits:{maxPositionPct:15,maxGrossPct:40,maxDailyLoss:100,maxSectorPct:25}}};
test("alignment through execution produces paper simulation only",()=>{const r=researchToPaper(sample,now);assert.equal(r.status,"paper_simulated");assert.equal(r.liveAuthorized,false);});
test("synthetic evidence cannot pass research bridge",()=>assert.equal(researchToPaper({...sample,dataProvenance:"synthetic"},now).status,"research_blocked"));
test("alignment veto blocks simulation",()=>assert.equal(researchToPaper({...sample,alignment:{...sample.alignment,supervisors:{buyVeto:true}}},now).status,"research_blocked"));
test("missing factor coverage blocks simulation",()=>assert.equal(researchToPaper({...sample,alignment:{...sample.alignment,canonical:{availability:40}}},now).status,"research_blocked"));
test("expired observations block simulation",()=>assert.equal(researchToPaper({...sample,marketAgeMs:61000},now).status,"research_blocked"));

test('council veto remains visible and cannot be overridden by READY label',()=>{
 const reason='Predictive model lacks independent point-in-time out-of-sample validation.';
 for(const buyState of ['WATCH','READY']){
  const result=researchToPaper({...sample,alignment:{...sample.alignment,buyState,decisionCouncil:{vetoes:[reason]}}},now);
  assert.equal(result.status,'research_blocked');assert.equal(result.simulation,null);
  assert.ok(result.blockers.includes('Decision council: '+reason));assert.equal(result.liveAuthorized,false);
 }
});
test('execution rejection and unfilled result expose the actual blocker at the top level',()=>{
 for(const quote of [null,{...sample.quote,observedAt:'2026-10-11T15:00:00Z'},{...sample.quote,ask:101},{...sample.quote,bid:96.99,ask:97}]){
  const result=researchToPaper({...sample,quote},now);
  assert.equal(result.status,'research_blocked');assert.ok(result.simulation?.execution);
  assert.ok(result.blockers.includes(result.simulation!.execution!.reason));
  assert.equal(result.liveAuthorized,false);
 }
});
test('risk blockers are retained and successful simulation has no invented blockers',()=>{
 const failed=researchToPaper({...sample,portfolio:{...sample.portfolio,cash:0}},now);
 assert.ok(failed.blockers.includes('Insufficient simulated available cash'));
 assert.equal(failed.simulation?.execution,null);
 const success=researchToPaper({...sample,alignment:{...sample.alignment,decisionCouncil:{vetoes:[]}}},now);
 assert.equal(success.status,'paper_simulated');assert.deepEqual(success.blockers,[]);assert.equal(success.liveAuthorized,false);
});

test('actual decision council scientific veto reaches paper workflow without weakening its gate',async()=>{
 const {evaluateDecisionCouncil}=await import('../lib/market/decisionCouncil.ts');
 const council=evaluateDecisionCouncil({
  alignment:{symbol:'SPY',readings:[],availability:100} as any,
  supervisors:{buyVeto:false,supervisors:[]} as any,
  marketSnapshot:{source:'TEST',price:100,timestamp:sample.quote.observedAt,quoteTimestamp:sample.quote.observedAt},
  intradayLastObserved:'2026-10-11T15:55:00Z',independentOutOfSampleVerified:false
 },now);
 assert.equal(council.executionAllowed,false);
 assert.equal(council.vetoes.length,1);assert.match(council.vetoes[0],/out-of-sample/);
 const result=researchToPaper({...sample,alignment:{...sample.alignment,buyState:'WATCH',decisionCouncil:council}},now);
 assert.equal(result.status,'research_blocked');assert.equal(result.simulation,null);
 assert.ok(result.blockers.includes('Decision council: '+council.vetoes[0]));
});
