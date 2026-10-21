import test from "node:test";
import assert from "node:assert/strict";
import {pairedProspectiveValidation,phase4InfrastructureGate} from "../lib/research/phase4-validation.ts";

test("paired prospective validation measures baseline minus challenger Brier improvement",()=>{
 const rows=Array.from({length:240},(_,i)=>({
  time:new Date(Date.UTC(2026,9,1+Math.floor(i/12),13,i%60)).toISOString(),
  baselineLoss:.30+(i%3)*.001,
  challengerLoss:.27+(i%3)*.001
 }));
 const out=pairedProspectiveValidation(rows);
 assert.equal(out.pairs,240);
 assert.ok(out.sessions>=20);
 assert.ok((out.meanImprovement??0)>.02);
 assert.ok((out.lowerBound??0)>0);
 assert.equal(out.mature,true);
});

test("paired prospective validation remains immature before 20 independent sessions",()=>{
 const rows=Array.from({length:220},(_,i)=>({
  time:new Date(Date.UTC(2026,9,1+Math.floor(i/80),13,i%60)).toISOString(),
  baselineLoss:.3,challengerLoss:.25
 }));
 const out=pairedProspectiveValidation(rows);
 assert.ok(out.pairs>=200);
 assert.ok(out.sessions<20);
 assert.equal(out.mature,false);
});

test("Phase 4 infrastructure gate is independent from scientific certification",()=>{
 const pass=phase4InfrastructureGate({
  immutableRecords:335,immutableLinked:335,sourceAttested:335,strictSourceVerified:335,sourceHashAttested:32,structuralPointInTime:335,
  resolvedOutcomes:288,outcomeChronologyOk:288,baselineFingerprints:1,challengerFingerprints:1,
  pairedSamples:143,sessionDates:3,invalidEvidenceVintages:0
 });
 assert.equal(pass.passed,true);
 assert.equal(pass.scientificCertificationGranted,false);
 assert.equal(pass.modelPromotionAllowed,false);
 const fail=phase4InfrastructureGate({...{
  immutableRecords:335,immutableLinked:335,sourceAttested:335,strictSourceVerified:335,sourceHashAttested:32,structuralPointInTime:335,
  resolvedOutcomes:288,outcomeChronologyOk:288,baselineFingerprints:1,challengerFingerprints:1,
  pairedSamples:143,sessionDates:3,invalidEvidenceVintages:0
 },outcomeChronologyOk:287});
 assert.equal(fail.passed,false);
 assert.ok(fail.blockers.includes("outcome_chronology"));
});
