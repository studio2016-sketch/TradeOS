import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePredictionOutcomeRow,summarizePredictionOutcomeEntries} from '../lib/research/prediction-outcome-ledger.ts';
import {evaluateProspectivePairs} from '../lib/research/prospectiveTrial.ts';
import {assessScientificValidation} from '../lib/research/scientific-validation.ts';
import {PREDICTION_OUTCOME_RULE_VERSION as ruleVersion,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT as protocolFingerprint,PREDICTION_OUTCOME_PROTOCOL_ACTIVATION as activation} from '../lib/research/prediction-outcome-verdict.ts';

const row={id:'1',created_at:'2026-11-05T14:00:00Z',symbol:'TEST',horizon:'30m',model_version:'synthetic',direction:'bullish',probability:.6,
 source_snapshot:{outcomeProtocol:{ruleVersion,protocolFingerprint,activation}},resolved_at:'2026-11-05T14:30:01Z',realized_return:.002,max_favorable_excursion:.003,max_adverse_excursion:-.001,
 notes:JSON.stringify({ruleVersion,protocolFingerprint,sourceId:'Alpaca:iex',startObservationTime:'2026-11-05T13:59:59Z',evaluationObservationTime:'2026-11-05T14:30:01Z',quotedRoundTripCost:.0002,outcomeDisposition:'PASS'})};
const certificates=[{provider:'alpaca',feed:'iex',certification_kind:'exchange_authoritative_timestamp',valid_from:activation,valid_to:null,created_at:activation}];

test('a valid source-time certificate cannot clear the v3 resolver blocker',()=>{
 const original=JSON.stringify(row);
 const entry=evaluatePredictionOutcomeRow(row,certificates);
 assert.equal(entry.sourceTimeCertified,true);
 assert.equal(entry.fingerprintBoundAtPrediction,true);
 assert.equal(entry.evidenceClass,'PROSPECTIVE_PROTOCOL');
 assert.equal(entry.verdict,'PASS');
 assert.equal(entry.realizedReturn,.002);
 assert.equal(entry.maximumFavorableExcursion,.003);
 assert.equal(entry.scientificallyEligible,false);
 assert.equal(entry.protocolConformance.code,'V3_RESOLVER_PROTOCOL_MISMATCH');
 assert.equal(JSON.stringify(row),original);
 const summary=summarizePredictionOutcomeEntries([entry]);
 assert.equal(summary.predictions,1);assert.equal(summary.resolved,1);assert.equal(summary.passes,1);
 assert.equal(summary.prospectiveScientificRecords,0);assert.equal(summary.protocolConformance.status,'BLOCKED');
});

test('missing certificate stays ineligible while preserving descriptive failures',()=>{
 const entry=evaluatePredictionOutcomeRow({...row,realized_return:-.002},[]);
 assert.equal(entry.sourceTimeCertified,false);assert.equal(entry.scientificallyEligible,false);assert.equal(entry.verdict,'FAIL');
 assert.equal(summarizePredictionOutcomeEntries([entry]).failures,1);
});

test('mature positive synthetic pairs keep descriptive metrics but cannot certify depth or skill',()=>{
 const rows=Array.from({length:250},(_,i)=>({timestamp:new Date(Date.UTC(2026,10,5+Math.floor(i/10),14)).toISOString(),symbol:'TEST',baselineP:.5,challengerP:.9,outcome:1 as const}));
 const result=evaluateProspectivePairs(rows);
 assert.equal(result.pairedCount,250);assert.equal(result.independentSessionDates,25);
 assert.ok(result.clustered95PctInterval![0]>0);assert.equal(result.preliminaryEvidenceOfImprovement,true);
 assert.equal(result.eligibleForProspectiveDepth,false);assert.equal(result.eligibleForPredictiveSkill,false);
 const assessment=assessScientificValidation({forecastTotal:500,labelledForecasts:500,forecastSessionDates:25,immutableRecords:500,timeOrderedImmutableRecords:500,futureDatedImmutableRecords:0,independentlyTimestampVerified:500,publicationTimeVerified:500,accelerationRecords:500,accelerationSessionDates:25,replayTrials:500,replayCostLevels:3,prospectivePairs:250,prospectiveSessionDates:25,prospectiveIntervalLow:result.clustered95PctInterval![0],executionSlippageValidated:true,brokerReconciled:true,independentReplayVerified:true,registeredHypothesisFamily:true});
 for(const id of ['outcome_protocol_conformance','prospective_depth','prospective_skill'])assert.equal(assessment.gates.find(g=>g.id===id)?.state,'BLOCKED');
 assert.match(assessment.gates.find(g=>g.id==='prospective_depth')!.observed,/250 paired outcomes across 25 sessions/);
 assert.equal(assessment.gates.find(g=>g.id==='independent_source_timing')?.state,'PASS');
 assert.equal(assessment.approvedModelInfluence,false);assert.equal(assessment.liveExecutionAllowed,false);
});
