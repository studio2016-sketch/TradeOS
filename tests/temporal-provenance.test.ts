import test from "node:test";import assert from "node:assert/strict";import {auditForecastProvenance} from "../lib/research/temporalProvenance";
test("Timestamp audit detects future source data and outcomes earlier than predictions",()=>{
 const r=auditForecastProvenance([{forecastTime:"2026-10-15T10:00:00Z",resolvedAt:"2026-10-15T09:00:00Z",sourceSnapshot:{quote:{timestamp:"2026-10-15T12:00:00Z"}},evidence:[],modelVersion:"v1"}]);
 assert.equal(r.futureSourceTime,1);assert.equal(r.outcomeBeforeForecast,1);assert.equal(r.missingEvidence,1);assert.equal(r.readyForModelPromotion,false);
});
test("Clean timestamp arithmetic still cannot certify frozen historical sources",()=>{
 const r=auditForecastProvenance([{forecastTime:"2026-10-15T10:00:00Z",resolvedAt:"2026-10-15T11:00:00Z",sourceSnapshot:{observedAt:"2026-10-15T09:00:00Z"},evidence:[{id:"x"}],modelVersion:"v2"}]);
 assert.equal(r.futureSourceTime,0);assert.equal(r.missingSourceTime,0);assert.equal(r.historicalReconciliationComplete,false);
});
