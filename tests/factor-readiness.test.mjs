import test from "node:test";
import assert from "node:assert/strict";
import {auditFactorReadiness} from "../lib/research/factor-readiness.ts";

test("empty registry fails closed for all 120 factors",()=>{
 const result=auditFactorReadiness([],[],"2026-10-21T12:00:00Z");
 assert.equal(result.defined,120);
 assert.equal(result.populated,0);
 assert.equal(result.operationalCandidates,0);
 assert.equal(result.certified,0);
 assert.equal(Object.keys(result.byFamily).length,12);
 assert.equal(result.approvedForTrading,false);
});
test("populated alone does not imply operational or certified",()=>{
 const result=auditFactorReadiness([{factor_key:"daily_volume",source_name:null,calculation_method:null,expected_cadence:null,freshness_seconds:null,implementation_status:"unverified",permission_status:"unknown"}],[{factor_key:"daily_volume",populated_count:253,last_populated_at:"2026-10-20T21:00:00Z"}],"2026-10-21T12:00:00Z");
 assert.equal(result.populated,1);
 assert.equal(result.operationalCandidates,0);
 assert.equal(result.certified,0);
 assert.ok(result.factors.find(f=>f.key==="daily_volume")?.gaps.includes("SOURCE_UNMAPPED"));
});
test("future timestamps cannot be fresh",()=>{
 const result=auditFactorReadiness([{factor_key:"daily_volume",source_name:"Alpaca",calculation_method:"volume",expected_cadence:"daily",freshness_seconds:86400,implementation_status:"verified",permission_status:"verified"}],[{factor_key:"daily_volume",populated_count:1,last_populated_at:"2026-10-22T00:00:00Z"}],"2026-10-21T12:00:00Z");
 assert.equal(result.operationalCandidates,0);
});
