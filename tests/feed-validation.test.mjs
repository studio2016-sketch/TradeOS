import test from "node:test";
import assert from "node:assert/strict";
import {inspectMarketBar} from "../lib/decisions/feed-validation.ts";
const sample={symbol:"SPY",timestamp:"2026-10-19T14:00:00.000Z",receivedAt:"2026-10-19T14:00:01.000Z",close:600,volume:200,source:"test-fixture"};
test("accepts chronological synthetic fixture but not independent provenance",()=>{const x=inspectMarketBar(sample,"2026-10-19T14:00:05.000Z");assert.equal(x.accepted,true);assert.equal(x.provenanceVerified,false)});
test("rejects stale and future observations",()=>{assert.equal(inspectMarketBar(sample,"2026-10-19T14:10:05.000Z").accepted,false);assert.equal(inspectMarketBar(sample,"2026-10-19T13:59:00.000Z").accepted,false)});
test("rejects impossible receive order",()=>assert.equal(inspectMarketBar({...sample,receivedAt:"2026-10-19T13:00:00Z"},"2026-10-19T14:00:05Z").accepted,false));
test("rejects invalid market price",()=>assert.equal(inspectMarketBar({...sample,close:-1},"2026-10-19T14:00:05Z").accepted,false));
