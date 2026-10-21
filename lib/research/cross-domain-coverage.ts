import {FACTOR_KEYS,observedFactorCoverage} from "./acceleration-factors";
export type FactorObservation={key:string;value:number;source:string;observedAt:string;applicableTo:"stock"|"option"|"macro"|"news"|"portfolio"};
export function assessCrossDomainCoverage(records:FactorObservation[],asOf:string){
 const clock=Date.parse(asOf);if(!Number.isFinite(clock))throw Error("Invalid cutoff");
 const latest=new Map<string,FactorObservation>();const rejected:{key:string;reason:string}[]=[];
 for(const r of records){
  const time=Date.parse(r.observedAt);
  let reason="";
  if(!FACTOR_KEYS.includes(r.key))reason="unknown_factor";
  else if(!Number.isFinite(r.value))reason="invalid_value";
  else if(!r.source.trim())reason="missing_source";
  else if(!Number.isFinite(time)||time>clock)reason="unavailable_at_decision_time";
  else if(!["stock","option","macro","news","portfolio"].includes(r.applicableTo))reason="invalid_domain";
  if(reason){rejected.push({key:r.key,reason});continue;}
  const prev=latest.get(r.key);
  if(!prev||Date.parse(prev.observedAt)<time)latest.set(r.key,r);
 }
 const coverage=observedFactorCoverage(Object.fromEntries([...latest.values()].map(r=>[r.key,r.value])));
 const byDomain=Object.fromEntries(["stock","option","macro","news","portfolio"].map(domain=>[domain,[...latest.values()].filter(r=>r.applicableTo===domain).length]));
 return {asOf,measured:coverage.observed,target:101,met:coverage.observed>=101,missing:coverage.missing,byDomain,rejected,eligibleValues:[...latest.values()],approvedForTrading:false,warning:"Cross-domain measured coverage is not per-stock coverage and does not establish predictive usefulness."};
}
