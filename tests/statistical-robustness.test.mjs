import assert from "node:assert/strict";
import test from "node:test";
import {holmBonferroni,neweyWestMean} from "../lib/research/statistical-robustness.ts";
test("Holm adjustment preserves original hypothesis order",()=>{
 const r=holmBonferroni([0.04,0.001,0.03]);
 assert.deepEqual(r.rejected,[false,true,false]);
 assert.deepEqual(r.adjusted,[0.06,0.003,0.06]);
 assert.equal(r.note.includes("unreported"),true);
});
test("rejects fabricated invalid p-values",()=>assert.throws(()=>holmBonferroni([.02,NaN])));
test("Newey West confidence interval includes mean for constant returns",()=>{
 const r=neweyWestMean([.01,.01,.01,.01,.01],2);
 assert.ok(Math.abs(r.standardError)<1e-8);assert.equal(r.certificationAllowed,false);
});
test("lags must be smaller than sample",()=>assert.throws(()=>neweyWestMean([.01,.02,.03],3)));
