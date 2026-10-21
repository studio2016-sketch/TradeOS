import test from "node:test";
import assert from "node:assert/strict";
import {phase5InfrastructureGate,phase5ScientificStatus} from "../lib/research/phase5-validation.ts";

test("Phase 5 infrastructure can complete while scientific certification remains locked",()=>{
 const gate=phase5InfrastructureGate({
  phase4Passed:true,executionSnapshots:2,executionImplementation:"quoted-spread-and-fill-slippage-v1",
  brokerImplementation:"paginated-read-only-v2",sourceCertificationLedgerReady:true,fillSlippageLedgerReady:true,
  appendOnlyProtectedTables:10,certificationFailClosed:true
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
