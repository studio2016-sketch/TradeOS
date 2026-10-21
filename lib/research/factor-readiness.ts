import {FACTOR_CATALOG, FACTOR_KEYS} from "./acceleration-factors";

export type RegistryRow = {
 factor_key:string; source_name:string|null; calculation_method:string|null;
 expected_cadence:string|null; freshness_seconds:number|null;
 implementation_status:string|null; permission_status:string|null;
};
export type CoverageRow = {factor_key:string; populated_count:number|string|null; last_populated_at:string|null};

/** Fail closed: observed coverage is never treated as verified or operational. */
export function auditFactorReadiness(registry:RegistryRow[], coverage:CoverageRow[], asOf:string){
 const now=Date.parse(asOf);
 if(!Number.isFinite(now))throw Error("Invalid audit timestamp");
 const known=new Set<string>(FACTOR_KEYS);
 const byKey=new Map(registry.map(row=>[row.factor_key,row]));
 const observed=new Map(coverage.map(row=>[row.factor_key,row]));
 const factors=FACTOR_CATALOG.map(({family,key})=>{
  const r=byKey.get(key),s=observed.get(key);
  const count=Number(s?.populated_count??0);
  const populated=Number.isFinite(count)&&count>0;
  const sourceMapped=!!r?.source_name?.trim();
  const calculationMapped=!!r?.calculation_method?.trim();
  const cadenceMapped=!!r?.expected_cadence?.trim();
  const freshnessPolicy=Number.isFinite(r?.freshness_seconds)&&Number(r?.freshness_seconds)>0;
  const last=s?.last_populated_at?Date.parse(s.last_populated_at):NaN;
  const fresh=freshnessPolicy&&Number.isFinite(last)&&last<=now&&now-last<=Number(r?.freshness_seconds)*1000;
  const implementationVerified=r?.implementation_status==="verified";
  const permissionVerified=r?.permission_status==="verified";
  const gaps=[
   ...(!r?["NOT_REGISTERED"]:[]),
   ...(!populated?["NO_POPULATED_OBSERVATIONS"]:[]),
   ...(!sourceMapped?["SOURCE_UNMAPPED"]:[]),
   ...(!calculationMapped?["CALCULATION_UNMAPPED"]:[]),
   ...(!cadenceMapped||!freshnessPolicy?["FRESHNESS_POLICY_MISSING"]:[]),
   ...(!fresh?["NOT_FRESH_OR_UNPROVEN"]:[]),
   ...(!implementationVerified?["IMPLEMENTATION_UNVERIFIED"]:[]),
   ...(!permissionVerified?["PERMISSION_UNVERIFIED"]:[])
  ];
  return {key,family,populated,sourceMapped,calculationMapped,cadenceMapped,freshnessPolicy,fresh,implementationVerified,permissionVerified,operationalCandidate:gaps.length===0,gaps};
 });
 const count=(predicate:(f:typeof factors[number])=>boolean)=>factors.filter(predicate).length;
 return {
  asOf,defined:FACTOR_KEYS.length,registered:count(f=>!f.gaps.includes("NOT_REGISTERED")),
  populated:count(f=>f.populated),unpopulated:count(f=>!f.populated),
  sourceMapped:count(f=>f.sourceMapped),calculationMapped:count(f=>f.calculationMapped),
  freshnessPolicies:count(f=>f.cadenceMapped&&f.freshnessPolicy),
  operationalCandidates:count(f=>f.operationalCandidate),
  certified:0, // Certification must be independently established; never infer it here.
  unknownRegistryKeys:registry.map(r=>r.factor_key).filter(key=>!known.has(key)),
  unknownCoverageKeys:coverage.map(r=>r.factor_key).filter(key=>!known.has(key)),
  duplicateRegistryKeys:registry.map(r=>r.factor_key).filter((key,i)=>registry.findIndex(r=>r.factor_key===key)!==i),
  duplicateCoverageKeys:coverage.map(r=>r.factor_key).filter((key,i)=>coverage.findIndex(r=>r.factor_key===key)!==i),
  byFamily:Object.fromEntries([...new Set(FACTOR_CATALOG.map(f=>f.family))].map(family=>[family,{defined:10,populated:factors.filter(f=>f.family===family&&f.populated).length,operationalCandidates:factors.filter(f=>f.family===family&&f.operationalCandidate).length}])),
  factors,approvedForTrading:false
 };
}
