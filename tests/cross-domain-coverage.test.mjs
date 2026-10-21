import test from "node:test";import assert from "node:assert/strict";
import {assessCrossDomainCoverage} from "../lib/research/cross-domain-coverage.ts";
const at="2026-10-20T15:00:00Z";
test("counts independent keys rather than duplicate reports",()=>{const r=assessCrossDomainCoverage([{key:"daily_volume",value:100,source:"feed",observedAt:at,applicableTo:"stock"},{key:"daily_volume",value:120,source:"feed",observedAt:at,applicableTo:"stock"}],at);assert.equal(r.measured,1);assert.equal(r.met,false)});
test("rejects readings after decision time",()=>{const r=assessCrossDomainCoverage([{key:"daily_volume",value:120,source:"feed",observedAt:"2026-10-21T15:00:00Z",applicableTo:"stock"}],at);assert.equal(r.measured,0);assert.equal(r.rejected[0].reason,"unavailable_at_decision_time")});
test("rejects unattributed measurements",()=>assert.equal(assessCrossDomainCoverage([{key:"daily_volume",value:0,source:"",observedAt:at,applicableTo:"stock"}],at).measured,0));
