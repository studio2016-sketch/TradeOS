import test from "node:test";
import assert from "node:assert/strict";
import {coverageGate,factorCoveragePolicy} from "../lib/research/factor-coverage-policy.ts";
test("target is at least 101 measured values",()=>{assert.equal(coverageGate(100,120).passed,false);assert.equal(coverageGate(101,120).passed,true)});
test("missing values cannot be counted as applicable",()=>assert.throws(()=>coverageGate(101,80)));
test("invalid coverage is rejected",()=>assert.throws(()=>coverageGate(-1,120)));
test("unknowns cannot be replaced by fabricated zero",()=>assert.ok(factorCoveragePolicy.forbid.includes("zero used for unknown")));
