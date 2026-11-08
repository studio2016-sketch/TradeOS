import {FACTOR_KEYS} from './acceleration-factors';
import {evidenceTimestamp} from './evidence-time';
export type EvidenceCandidate={factor:string;value:number;source:string;subject:string;observedAt:string;availableAt:string;domain:'stock'|'option'|'macro'|'news'|'portfolio'};
const ages={stock:86400000*5,option:3600000*4,macro:86400000*550,news:86400000*2,portfolio:86400000*2};
export const EVIDENCE_INTAKE_POLICY_VERSION='tradeos.evidence-intake.v2';
export function validateEvidence(input:unknown,now=new Date()){
 const reasons:string[]=[];
 const result=()=>({accepted:reasons.length===0,reasons,policyVersion:EVIDENCE_INTAKE_POLICY_VERSION,sourceVerified:false,calculationVerified:false,scientificallyCertified:false});
 if(!input||typeof input!=='object'||Array.isArray(input)){reasons.push('invalid_evidence_shape');return result();}
 const e=input as Record<string,unknown>;
 if(typeof e.factor!=='string'||!(FACTOR_KEYS as readonly string[]).includes(e.factor))reasons.push('unregistered_factor');
 if(typeof e.value!=='number'||!Number.isFinite(e.value))reasons.push('nonfinite_value');
 if(typeof e.source!=='string'||!e.source.trim()||typeof e.subject!=='string'||!e.subject.trim())reasons.push('missing_source_or_subject');
 const domain=typeof e.domain==='string'&&Object.hasOwn(ages,e.domain)?e.domain as keyof typeof ages:null;
 if(!domain)reasons.push('invalid_domain');
 const clock=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(clock))reasons.push('invalid_clock');
 const observation=evidenceTimestamp(e.observedAt),availability=evidenceTimestamp(e.availableAt);
 const clockNs=Number.isFinite(clock)?BigInt(clock)*BigInt(1000000):null;
 // Preserve the existing 30-second receipt clock allowance. It is not a decision-time guarantee.
 if(observation===null||availability===null||observation>availability||clockNs!==null&&availability>clockNs+BigInt(30000000000))reasons.push('invalid_vintage');
 if(domain&&availability!==null&&clockNs!==null&&clockNs-availability>BigInt(ages[domain])*BigInt(1000000))reasons.push('stale_ingestion');
 if(typeof e.value==='number'){
  if(e.factor==='implied_vol_atm'&&(e.value<=0||e.value>10))reasons.push('invalid_implied_volatility');
  if(e.factor==='iv_skew'&&Math.abs(e.value)>10)reasons.push('implausible_iv_skew');
  if(e.factor==='net_margin'&&(e.value< -100||e.value>1))reasons.push('implausible_net_margin_fraction');
 }
 return result();
}
