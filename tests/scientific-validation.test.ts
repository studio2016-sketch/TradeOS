import test from "node:test";
import assert from "node:assert/strict";
import {assessScientificValidation,type ScientificValidationInput} from "../lib/research/scientific-validation.ts";

const evidence:ScientificValidationInput={forecastTotal:901,labelledForecasts:811,forecastSessionDates:10,
 immutableRecords:403,timeOrderedImmutableRecords:403,futureDatedImmutableRecords:0,
 independentlyTimestampVerified:0,publicationTimeVerified:0,accelerationRecords:502,accelerationSessionDates:2,
 replayTrials:2820,replayCostLevels:3,prospectivePairs:169,prospectiveSessionDates:3,prospectiveIntervalLow:null,
 executionSlippageValidated:false,brokerReconciled:false,independentReplayVerified:false,registeredHypothesisFamily:false};

test("scientific validation distinguishes ordering from independent timing",()=>{
 const result=assessScientificValidation(evidence);
 assert.equal(result.gates.find(g=>g.id==="immutable_temporal_ordering")?.state,"PASS");
 assert.equal(result.gates.find(g=>g.id==="independent_source_timing")?.state,"BLOCKED");
 assert.equal(result.predictiveCertification,"BLOCKED");
 assert.equal(result.liveExecutionAllowed,false);
});

test("prospective skill cannot pass before sample and session depth",()=>{
 const result=assessScientificValidation({...evidence,prospectiveIntervalLow:.01});
 assert.equal(result.gates.find(g=>g.id==="prospective_skill")?.state,"BLOCKED");
 assert.match(result.nextMilestone,/31 additional valid paired outcomes/);
});

test("even mature positive evidence does not bypass independent certification",()=>{
 const result=assessScientificValidation({...evidence,forecastSessionDates:25,prospectivePairs:250,prospectiveSessionDates:25,
  prospectiveIntervalLow:.01,independentlyTimestampVerified:403,publicationTimeVerified:403,
  executionSlippageValidated:true,brokerReconciled:true,independentReplayVerified:true,registeredHypothesisFamily:true});
 assert.equal(result.gates.find(g=>g.id==="prospective_skill")?.state,"PASS");
 assert.equal(result.approvedModelInfluence,false);
 assert.equal(result.predictiveCertification,"BLOCKED");
});

test("invalid evidence fails closed",()=>{
 assert.throws(()=>assessScientificValidation({...evidence,forecastTotal:-1}),/Invalid validation evidence/);
});
