import test from "node:test";import assert from "node:assert/strict";
import {TRIAL_ACTIVATION,CERTIFICATION_ACTIVATION,challengerProbability} from "../lib/research/frozenChallenger.ts";
import {evaluateProspectivePairs} from "../lib/research/prospectiveTrial.ts";
test("Prospective challenger is frozen before Monday and has bounded probability",()=>{assert.equal(TRIAL_ACTIVATION,"2026-10-19T13:30:00.000Z");assert.ok(challengerProbability({return75m:.05,vwapAligned:true,spreadRatio:.004,quality:.8})!<=.64)});
test("Certification epoch begins only after immutable challenger capture was repaired",()=>{assert.equal(CERTIFICATION_ACTIVATION,"2026-10-21T17:15:00.000Z");assert.ok(Date.parse(CERTIFICATION_ACTIVATION)>Date.parse(TRIAL_ACTIVATION));});
test("Small or single-session studies cannot promote the challenger",()=>{
 const rows=Array.from({length:220},(_,i)=>({timestamp:new Date(Date.UTC(2026,9,19,14)+i*12000).toISOString(),symbol:"SPY",baselineP:.60,challengerP:.53,outcome:(i%3===0?1:0) as 0|1}));
 const r=evaluateProspectivePairs(rows);assert.equal(r.status,"INSUFFICIENT_PROSPECTIVE_DATA");assert.equal(r.eligibleForLive,false);assert.equal(r.clustered95PctInterval,null);
});
