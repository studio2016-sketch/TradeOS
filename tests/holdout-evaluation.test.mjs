import {evaluateLockedHoldout} from "../lib/research/holdout-evaluation.ts";
import assert from "node:assert/strict";
import test from "node:test";
test("cost deductions are applied",()=>{
 const x=evaluateLockedHoldout([{time:"2026-01-01",signal:1,nextReturn:0.02},{time:"2026-01-02",signal:-1,nextReturn:-0.01}],10);
 assert.ok(Math.abs(x.meanNetReturn-.014)<1e-10);
 assert.equal(x.eligibleForPromotion,false);
});
test("rejects lookback ordering errors",()=>assert.throws(()=>evaluateLockedHoldout([{time:"2026-01-02",signal:1,nextReturn:.01},{time:"2026-01-01",signal:1,nextReturn:.01}],1)));
test("rejects invalid costs",()=>assert.throws(()=>evaluateLockedHoldout([{time:"2026-01-01",signal:1,nextReturn:.01},{time:"2026-01-02",signal:1,nextReturn:.01}],-1)));
test("never certifies even positive holdout",()=>assert.equal(evaluateLockedHoldout([{time:"2026-01-01",signal:1,nextReturn:.9},{time:"2026-01-02",signal:1,nextReturn:.9}],0).eligibleForPromotion,false));
