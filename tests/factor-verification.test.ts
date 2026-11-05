import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FACTOR_IMPLEMENTATION_VERIFICATION,auditFactorVerification} from "../lib/research/factor-verification.ts";
import {FACTOR_KEYS} from "../lib/research/acceleration-factors.ts";

test("PostgreSQL finite evidence predicate rejects NaN, infinity and null explicitly",()=>{
 // PostgreSQL considers NaN = NaN true; a JavaScript-style self-equality
 // check does not reject it. bool_and also ignores null inputs.
 const route=readFileSync(new URL("../app/api/factor-verification/route.ts",import.meta.url),"utf8");
 assert.match(route,/bool_and\(value is not null and value not in \('NaN'::float8,'Infinity'::float8,'-Infinity'::float8\)\) finite_ok/);
 assert.doesNotMatch(route,/value\s*=\s*value/);
});

test("nonfinite evidence cannot pass engineering or source-time verification",()=>{
 const evidence=[{factorKey:"daily_volume",observations:10,subjects:3,sourceTimeEligibleObservations:10,sources:["Alpaca:iex"],latestAvailableAt:"2026-10-23T09:00:00Z",chronologyOk:true,finiteOk:false}];
 const audit=auditFactorVerification(evidence,[],"2026-10-23T10:00:00Z");
 const factor=audit.factors.find(x=>x.key==="daily_volume")!;
 assert.equal(factor.status,"MEASURED_UNVERIFIED");
 assert.ok(factor.blockers.includes("NONFINITE_EVIDENCE"));
 assert.equal(factor.modelInfluenceAllowed,false);
 assert.equal(audit.counts.fullyVerified,0);
});

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

test('risk implementation tests do not retroactively verify legacy, mixed, or version-labeled rows',()=>{
 for(const factorKey of ['beta','rolling_correlation']){
  for(const implementationMethods of [undefined,[],[''],['legacy'],['pearson_correlation'],['synchronized_return_covariance_over_variance_v2'],['synchronized_return_pearson_v2'],['legacy','synchronized_return_pearson_v2']]){
   const row={factorKey,observations:36,subjects:3,sourceTimeEligibleObservations:36,sources:['Alpaca:iex:1Day'],latestAvailableAt:'2026-11-05T00:00:00Z',chronologyOk:true,finiteOk:true,implementationMethods};
   const result=auditFactorVerification([row],[],'2026-11-05T01:00:00Z').factors.find(x=>x.key===factorKey)!;
   assert.equal(result.status,'MEASURED_UNVERIFIED');
   assert.equal(result.gates.implementationVerified,true);
   assert.equal(result.gates.implementationEvidenceLinkageRequired,true);
   assert.equal(result.gates.implementationEvidenceLinked,false);
   assert.equal(result.gates.sourceTimeCertified,true); // Separate timing evidence never bypasses linkage.
   assert.equal(result.gates.sourceIdentityVerified,true);
   assert.equal(result.modelInfluenceAllowed,false);
   assert.ok(result.blockers.includes('ROW_IMPLEMENTATION_EVIDENCE_LINKAGE_UNPROVEN'));
   assert.deepEqual(result.observedImplementationMethods,implementationMethods??[]);
  }
 }
});
test('missing risk observations remain unmeasured and other factors do not claim row-level linkage',()=>{
 const audit=auditFactorVerification([],[],'2026-11-05T01:00:00Z');
 assert.equal(audit.factors.find(x=>x.key==='beta')!.status,'UNMEASURED');
 const other=audit.factors.find(x=>x.key==='daily_volume')!;
 assert.equal(other.gates.implementationEvidenceLinkageRequired,false);
 assert.equal(other.gates.implementationEvidenceLinked,null);
});
test('risk manifest names the actual tested collector helper, not the unrelated market implementation',()=>{
 for(const key of ['beta','rolling_correlation']){
  const entry=FACTOR_IMPLEMENTATION_VERIFICATION.get(key)!;
  assert.equal(entry.implementationPath,'lib/research/synchronized-risk-statistics.ts');
  assert.match(entry.verificationSuite,/network-risk-integration/);
 }
 const route=readFileSync(new URL('../app/api/factor-verification/route.ts',import.meta.url),'utf8');
 assert.match(route,/array_agg\(distinct coalesce\(source_metadata->>'method',''\)/);
 assert.match(route,/from tradeos_factor_evidence group by factor_key/);
});
