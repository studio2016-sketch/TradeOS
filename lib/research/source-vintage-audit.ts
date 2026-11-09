import {evidenceTimestamp} from './evidence-time';
import {FACTOR_KEYS} from "./acceleration-factors";
export type Domain="stock"|"option"|"macro"|"news"|"portfolio";
export type Evidence={factor:string;value:number;domain:Domain;source:string;observedAt:string;availableAt:string;subject:string};
export function auditEvidence(records:Evidence[],decisionTime:string){
 const t=evidenceTimestamp(decisionTime);
 if(t===null)throw Error("Invalid decision time");
 if(!Array.isArray(records))throw Error("Invalid evidence records");
 const accepted=new Map<string,{e:Evidence;receipt:bigint}>(),reasons:Record<string,number>={};
 for(const e of records){
  if(!e||typeof e!=='object'){reasons.invalid_record=(reasons.invalid_record??0)+1;continue;}
  const o=evidenceTimestamp(e.observedAt),a=evidenceTimestamp(e.availableAt);
  const knownDomain=['stock','option','macro','news','portfolio'].includes(e.domain);
  const reason=!(FACTOR_KEYS as readonly string[]).includes(e.factor)?'unknown_factor':typeof e.value!=='number'||!Number.isFinite(e.value)?'invalid_value':
   typeof e.source!=='string'||!e.source.trim()||typeof e.subject!=='string'||!e.subject.trim()?'unattributed':
   !knownDomain?'invalid_domain':o===null||a===null||a<o||a>t?'unavailable_at_decision':null;
  if(reason){reasons[reason]=(reasons[reason]??0)+1;continue;}
  const old=accepted.get(e.factor);
  if(!old||old.receipt<a!)accepted.set(e.factor,{e,receipt:a!});
 }
 const domains:Record<Domain,number>={stock:0,option:0,macro:0,news:0,portfolio:0};
 for(const {e} of accepted.values())domains[e.domain]++;
 return {measured:accepted.size,target:101,passed:accepted.size>=101,domains,missing:FACTOR_KEYS.filter(k=>!accepted.has(k)),rejected:reasons,evidence:[...accepted.values()].map(x=>x.e),certified:false};
}
