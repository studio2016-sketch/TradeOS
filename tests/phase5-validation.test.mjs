import test from "node:test";
import assert from "node:assert/strict";
import {phase5InfrastructureGate,phase5ScientificStatus} from "../lib/research/phase5-validation.ts";

test("Phase 5 infrastructure can complete while scientific certification remains locked",()=>{
 const gate=phase5InfrastructureGate({
  phase4Passed:true,certificationForecasts:4,immutableCleanRecords:4,strictCleanVerified:4,executionSnapshots:2,executionImplementation:"quoted-spread-and-fill-slippage-v1",
  brokerImplementation:"paginated-read-only-v2",sourceCertificationLedgerReady:true,fillSlippageLedgerReady:true,portfolioReconciliationLedgerReady:true,
  appendOnlyProtectedTables:11,certificationFailClosed:true
 });
 assert.equal(gate.passed,true);
 assert.equal(gate.scientificCertificationGranted,false);
 assert.equal(gate.modelPromotionAllowed,false);
});

test("Phase 5 scientific status keeps time and account evidence fail-closed",()=>{
 const status=phase5ScientificStatus({
  immutableRecords:350,independentlyCertifiedSourceTimes:0,pairedSamples:160,independentSessions:3,
  pairedSkillLowerBound:.003,modeledCostLowerBound:null,modeledCostMature:false,
  empiricalSlippageValidated:false,portfolioReconciled:false
 });
 assert.equal(status.scientificallyMature,false);
 assert.ok(status.blockers.some(x=>x.id==="independent_session_floor"));
 assert.ok(status.blockers.some(x=>x.id==="empirical_fill_slippage"&&x.requiresUserAction));
});

test("positive certified inputs cannot bypass resolver conformance",()=>{
 const status=phase5ScientificStatus({immutableRecords:300,independentlyCertifiedSourceTimes:300,pairedSamples:250,independentSessions:25,pairedSkillLowerBound:.01,modeledCostLowerBound:.005,modeledCostMature:true,empiricalSlippageValidated:true,portfolioReconciled:true});
 assert.equal(status.scientificallyMature,false);
 assert.deepEqual(status.blockers.map(x=>x.id),["outcome_protocol_conformance"]);
 assert.equal(status.protocolConformance.status,"BLOCKED");
 assert.equal(status.modelPromotionAllowed,false);
});
