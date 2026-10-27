import test from "node:test";
import assert from "node:assert/strict";
import {FACTOR_IMPLEMENTATION_VERIFICATION,auditFactorVerification} from "../lib/research/factor-verification.ts";
import {FACTOR_KEYS} from "../lib/research/acceleration-factors.ts";

test("verified implementation manifest contains only canonical factors and exceeds the 60-factor engineering target",()=>{
 assert.ok(FACTOR_IMPLEMENTATION_VERIFICATION.size>=60);
 const canonical=new Set<string>(FACTOR_KEYS);
 for(const key of FACTOR_IMPLEMENTATION_VERIFICATION.keys())assert.ok(canonical.has(key),key);
});
test("engineering verification remains separate from source-time and predictive verification",()=>{
 const evidence=[{factorKey:"daily_volume",observations:10,subjects:3,sourceTimeEligibleObservations:10,sources:["Alpaca:iex"],latestAvailableAt:"2026-10-23T09:00:00Z",chronologyOk:true,finiteOk:true}];
 const certificate={provider:"alpaca",feed:"iex",certification_kind:"exchange_authoritative_timestamp",valid_from:"2026-10-23T08:00:00Z",valid_to:null,created_at:"2026-10-23T08:00:00Z"};
 const audit=auditFactorVerification(evidence,[certificate],"2026-10-23T10:00:00Z");
 const factor=audit.factors.find(x=>x.key==="daily_volume")!;
 assert.equal(factor.status,"SOURCE_TIME_VERIFIED");
 assert.equal(factor.gates.implementationVerified,true);
 assert.equal(factor.gates.sourceTimeCertified,true);
 assert.equal(factor.modelInfluenceAllowed,false);
 assert.equal(audit.counts.fullyVerified,0);
});
test("a certificate created after the evidence cannot verify its timestamp",()=>{
 const evidence=[{factorKey:"daily_volume",observations:10,subjects:3,sourceTimeEligibleObservations:0,sources:["Alpaca:iex"],latestAvailableAt:"2026-10-23T09:00:00Z",chronologyOk:true,finiteOk:true}];
 const certificate={provider:"alpaca",feed:"iex",certification_kind:"exchange_authoritative_timestamp",valid_from:"2026-10-23T09:01:00Z",valid_to:null,created_at:"2026-10-23T09:01:00Z"};
 const factor=auditFactorVerification(evidence,[certificate],"2026-10-23T10:00:00Z").factors.find(x=>x.key==="daily_volume")!;
 assert.equal(factor.status,"ENGINEERING_VERIFIED");
 assert.equal(factor.gates.sourceTimeCertified,false);
});
test("one post-certificate row cannot certify a factor containing older rows",()=>{
 const evidence=[{factorKey:"daily_volume",observations:10,subjects:3,sourceTimeEligibleObservations:1,sources:["Alpaca:iex"],latestAvailableAt:"2026-10-23T09:00:00Z",chronologyOk:true,finiteOk:true}];
 const certificate={provider:"alpaca",feed:"iex",certification_kind:"exchange_authoritative_timestamp",valid_from:"2026-10-23T08:00:00Z",valid_to:null,created_at:"2026-10-23T08:00:00Z"};
 const factor=auditFactorVerification(evidence,[certificate],"2026-10-23T10:00:00Z").factors.find(x=>x.key==="daily_volume")!;
 assert.equal(factor.gates.sourceTimeCertified,false);
 assert.equal(factor.status,"ENGINEERING_VERIFIED");
});
