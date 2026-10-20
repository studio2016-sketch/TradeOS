import test from "node:test";
import assert from "node:assert/strict";
import {classifyNewsEvidence,macroSourceCatalog} from "../lib/research/global-financial-sources.ts";
const item={id:"example",headline:"Example market event",sourceId:"FED",publishedAt:"2026-10-20T12:00:00Z",firstObservedAt:"2026-10-20T12:01:00Z",instruments:["SPY"],drivers:["policy_rate"],impactHypothesis:"Rates can affect discounted valuations",corroboratingSourceIds:["REUTERS"]};
test("independent corroboration produces a lead, not an approved signal",()=>{const r=classifyNewsEvidence(item,"2026-10-20T12:02:00Z");assert.equal(r.admissibleAsResearchLead,true);assert.equal(r.predictiveSignalApproved,false);assert.equal(r.canTriggerTrade,false)});
test("same source cannot self-corroborate",()=>assert.equal(classifyNewsEvidence({...item,corroboratingSourceIds:["FED"]},"2026-10-20T12:02:00Z").admissibleAsResearchLead,false));
test("rejects future-leaking observations",()=>assert.equal(classifyNewsEvidence({...item,firstObservedAt:"2026-10-21T12:01:00Z"},"2026-10-20T12:02:00Z").admissibleAsResearchLead,false));
test("source catalog covers global monetary and company fundamentals",()=>{assert.ok(macroSourceCatalog.some(x=>x.id==="SEC"));assert.ok(macroSourceCatalog.some(x=>x.id==="BOJ"));assert.ok(macroSourceCatalog.some(x=>x.id==="BIS"))});
