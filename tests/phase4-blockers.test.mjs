import test from "node:test";
import assert from "node:assert/strict";
import {phase4ScientificBlockers} from "../lib/research/phase4-blockers.ts";

test("scientific maturity remains blocked when elapsed prospective sessions and source certification are missing",()=>{
 const out=phase4ScientificBlockers({
  pairedSamples:143,sessionDates:3,pairedLowerBound:.001,
  independentlyVerifiedSourceTimes:0,immutableRecords:339,
  costAdjustedReturnLowerBound:null,executionSlippageValidated:false,
  portfolioReconciled:false,publicationTimeApplicable:false,publicationTimeVerified:0
 });
 assert.equal(out.scientificallyMature,false);
 assert.ok(out.blockers.some(x=>x.id==="independent_session_floor"));
 assert.ok(out.blockers.some(x=>x.id==="independent_source_time_certification"));
 assert.equal(out.liveExecutionAllowed,false);
});

test("publication-time gate is conditional on publication-derived inputs",()=>{
 const base={
  pairedSamples:250,sessionDates:25,pairedLowerBound:.01,
  independentlyVerifiedSourceTimes:300,immutableRecords:300,
  costAdjustedReturnLowerBound:.001,executionSlippageValidated:true,
  portfolioReconciled:true,publicationTimeVerified:0
 };
 assert.equal(phase4ScientificBlockers({...base,publicationTimeApplicable:false}).scientificallyMature,true);
 const withPublications=phase4ScientificBlockers({...base,publicationTimeApplicable:true});
 assert.equal(withPublications.scientificallyMature,false);
 assert.ok(withPublications.blockers.some(x=>x.id==="publication_time_certification"));
});
