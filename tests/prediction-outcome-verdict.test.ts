import test from "node:test";
import assert from "node:assert/strict";
import {PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,predictionOutcomeVerdict} from "../lib/research/prediction-outcome-verdict.ts";
import {evaluatePredictionOutcomeRow,summarizePredictionOutcomeEntries} from "../lib/research/prediction-outcome-ledger.ts";
import {outcomeResolutionState} from "../lib/market/outcome-resolution-policy.ts";
const base={direction:"bullish",forecastAt:"2026-11-04T18:00:00Z",resolvedAt:"2026-11-04T18:30:00Z",realizedReturn:.003,quotedRoundTripCost:.0005};
test("PASS requires the locked net edge after quoted cost",()=>{const r=predictionOutcomeVerdict(base);assert.equal(r.verdict,"PASS");assert.ok(Math.abs((r.netReturn??0)-.0025)<1e-12);});
test("bearish outcomes reverse raw market return before grading",()=>assert.equal(predictionOutcomeVerdict({...base,direction:"bearish",realizedReturn:-.003}).verdict,"PASS"));
test("a valid mature prediction below the net threshold fails",()=>assert.equal(predictionOutcomeVerdict({...base,realizedReturn:.0014}).verdict,"FAIL"));
test("missing cost is void rather than a convenient zero",()=>assert.equal(predictionOutcomeVerdict({...base,quotedRoundTripCost:null}).verdict,"VOID"));
test("missing outcome stays unresolved",()=>assert.equal(predictionOutcomeVerdict({...base,resolvedAt:null,realizedReturn:null}).verdict,"UNRESOLVED"));
test("outcome before prediction is void",()=>assert.equal(predictionOutcomeVerdict({...base,resolvedAt:"2026-10-27T13:59:00Z"}).verdict,"VOID"));
test("protocol activation is immutable and precedes submitted prospective fixture",()=>assert.ok(Date.parse(PREDICTION_OUTCOME_PROTOCOL_ACTIVATION)<Date.parse(base.forecastAt)));
test("every verdict is bound to the frozen protocol fingerprint",()=>assert.match(predictionOutcomeVerdict(base).protocolFingerprint,/^[a-f0-9]{64}$/));
test("protocol fingerprint is stable",()=>assert.equal(PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,"e5f531c110c7df36dc8df7d517553b09b7074a76366ea87cf98d2a3b0608f82a"));
const ledgerRow={id:"1",created_at:base.forecastAt,symbol:"NVDA",horizon:"30m",model_version:"test-v1",direction:"bullish",probability:.6,source_snapshot:{outcomeProtocol:{ruleVersion:"tradeos.prediction-outcome.v3",protocolFingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,activation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION}},resolved_at:base.resolvedAt,realized_return:base.realizedReturn,max_favorable_excursion:.004,max_adverse_excursion:-.001,notes:JSON.stringify({ruleVersion:"tradeos.prediction-outcome.v3",protocolFingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,sourceId:"Alpaca:iex",startObservationTime:"2026-11-04T17:59:00Z",evaluationObservationTime:base.resolvedAt,quotedRoundTripCost:base.quotedRoundTripCost})};
const certificate={provider:"alpaca",feed:"iex",certification_kind:"exchange_authoritative_timestamp",valid_from:"2026-10-27T13:00:00Z",valid_to:null,created_at:"2026-10-27T13:00:00Z"};
test("a fingerprinted point-in-time outcome enters the scientific cohort",()=>{const entry=evaluatePredictionOutcomeRow(ledgerRow,[certificate]);assert.equal(entry.scientificallyEligible,true);assert.equal(summarizePredictionOutcomeEntries([entry]).prospectiveScientificRecords,1);});
test("the frozen baseline must be a recent prediction-time quote, never a future quote",()=>{
 const postForecast={...JSON.parse(ledgerRow.notes),startObservationTime:"2026-11-04T18:00:01Z"};
 const stale={...JSON.parse(ledgerRow.notes),startObservationTime:"2026-11-04T17:54:59Z"};
 assert.equal(evaluatePredictionOutcomeRow({...ledgerRow,notes:JSON.stringify(postForecast)},[certificate]).scientificallyEligible,false);
 assert.equal(evaluatePredictionOutcomeRow({...ledgerRow,notes:JSON.stringify(stale)},[certificate]).scientificallyEligible,false);
});
test("a fingerprint-bound pending prediction reports prospective source-time status without becoming scientific evidence",()=>{
 const pending=evaluatePredictionOutcomeRow({...ledgerRow,resolved_at:null,realized_return:null,notes:null,reconstructed_source_id:"Alpaca:iex",reconstructed_cost:.0005},[certificate]);
 assert.equal(pending.evidenceClass,"PROSPECTIVE_PROTOCOL_PENDING");assert.equal(pending.sourceTimeCertified,true);assert.equal(pending.scientificallyEligible,false);
});
test("an otherwise identical outcome without its frozen fingerprint is reconstruction only",()=>{const entry=evaluatePredictionOutcomeRow({...ledgerRow,notes:JSON.stringify({...JSON.parse(ledgerRow.notes),protocolFingerprint:undefined})},[certificate]);assert.equal(entry.scientificallyEligible,false);assert.equal(entry.evidenceClass,"HISTORICAL_RECONSTRUCTION");});
test("an outcome stamped only after prediction is never prospective evidence",()=>{const entry=evaluatePredictionOutcomeRow({...ledgerRow,source_snapshot:{}},[certificate]);assert.equal(entry.scientificallyEligible,false);assert.equal(entry.fingerprintBoundAtPrediction,false);});
test("a missing horizon observation becomes terminally void only after grace",()=>{
 assert.equal(outcomeResolutionState({forecastAt:base.forecastAt,horizon:"30m",now:"2026-11-04T18:44:59Z",completeSameFeedHorizon:false}),"PENDING_GRACE");
 assert.equal(outcomeResolutionState({forecastAt:base.forecastAt,horizon:"30m",now:"2026-11-04T18:45:01Z",completeSameFeedHorizon:false}),"TERMINAL_VOID");
});
test("a terminal void is displayed as VOID and never becomes scientific PASS/FAIL evidence",()=>{
 const entry=evaluatePredictionOutcomeRow({...ledgerRow,realized_return:null,notes:JSON.stringify({ruleVersion:"tradeos.prediction-outcome.v3",protocolFingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,outcomeDisposition:"VOID",reason:"complete_same_feed_horizon_unavailable_after_grace"})},[certificate]);
 assert.equal(entry.verdict,"VOID");assert.equal(entry.scientificallyEligible,false);
});
