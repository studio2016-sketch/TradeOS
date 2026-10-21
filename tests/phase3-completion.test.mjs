import test from "node:test";
import assert from "node:assert/strict";
import {phase3CompletionGate,PHASE3_MEASURED_FACTOR_TARGET} from "../lib/research/phase3-completion.ts";

test("Phase 3 completion target is 101 genuine measured factors",()=>{
 assert.equal(PHASE3_MEASURED_FACTOR_TARGET,101);
 assert.equal(phase3CompletionGate({measuredFactorCount:100,invalidEvidenceVintages:0,requiredCollectorFailures:0}).passed,false);
 assert.equal(phase3CompletionGate({measuredFactorCount:101,invalidEvidenceVintages:0,requiredCollectorFailures:0}).passed,true);
});
test("Phase 3 remains fail closed for invalid vintages or required collector failures",()=>{
 assert.equal(phase3CompletionGate({measuredFactorCount:101,invalidEvidenceVintages:1,requiredCollectorFailures:0}).passed,false);
 assert.equal(phase3CompletionGate({measuredFactorCount:101,invalidEvidenceVintages:0,requiredCollectorFailures:1}).passed,false);
});
