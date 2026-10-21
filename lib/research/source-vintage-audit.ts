import {FACTOR_KEYS} from "./acceleration-factors";
export type Domain="stock"|"option"|"macro"|"news"|"portfolio";
export type Evidence={factor:string;value:number;domain:Domain;source:string;observedAt:string;availableAt:string;subject:string};
export function auditEvidence(records:Evidence[],decisionTime:string){
 const t=Date.parse(decisionTime);
 if(!Number.isFinite(t))throw Error("Invalid decision time");
 const accepted=new Map<string,Evidence>(),reasons:Record<string,number>={};
 for(const e of records){
  const o=Date.parse(e.observedAt),a=Date.parse(e.availableAt);
  const reason=!(FACTOR_KEYS as readonly string[]).includes(e.factor)?"unknown_factor":!Number.isFinite(e.value)?"invalid_value":!e.source||!e.subject?"unattributed":!Number.isFinite(o)||!Number.isFinite(a)||a<o||a>t?"unavailable_at_decision":null;
  if(reason){reasons[reason]=(reasons[reason]??0)+1;continue;}
  const old=accepted.get(e.factor);
  if(!old||Date.parse(old.availableAt)<a)accepted.set(e.factor,e);
 }
 const domains:Record<Domain,number>={stock:0,option:0,macro:0,news:0,portfolio:0};
 for(const e of accepted.values())domains[e.domain]++;
 return {measured:accepted.size,target:101,passed:accepted.size>=101,domains,missing:FACTOR_KEYS.filter(k=>!accepted.has(k)),rejected:reasons,certified:false};
}
