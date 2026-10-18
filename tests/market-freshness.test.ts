import test from "node:test";import assert from "node:assert/strict";import {observationState,observedAgeMs,validHistoricalPoint} from "../lib/market/freshness";
const now=Date.parse("2026-10-18T17:00:00Z");
test("recent source timestamp is an observation, never exchange-certified",()=>assert.equal(observationState("2026-10-18T16:59:30Z",now),"recent_observation"));
test("stale prices cannot masquerade as current",()=>assert.equal(observationState("2026-10-17T17:00:00Z",now),"stale"));
test("reject future, missing, and invalid timestamps",()=>{assert.equal(observedAgeMs("",now),null);assert.equal(observedAgeMs("2026-10-18T17:10:00Z",now),null);assert.equal(observationState("garbage",now),"unknown")});
test("chart point must be dated and positive",()=>{assert.equal(validHistoricalPoint({t:"2026-10-18T16:55:00Z",c:100}),true);assert.equal(validHistoricalPoint({t:"",c:100}),false);assert.equal(validHistoricalPoint({t:"2026-10-18T16:55:00Z",c:0}),false)});
