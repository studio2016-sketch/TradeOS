import {FACTOR_KEYS} from "./acceleration-factors";
export type EvidenceCandidate={factor:string;value:number;source:string;subject:string;observedAt:string;availableAt:string;domain:"stock"|"option"|"macro"|"news"|"portfolio"};
const ages={stock:86400000*5,option:3600000*4,macro:86400000*550,news:86400000*2,portfolio:86400000*2};
export function validateEvidence(e:EvidenceCandidate,now=new Date()){
 const observation=Date.parse(e.observedAt),availability=Date.parse(e.availableAt),clock=now.getTime();
 const reasons:string[]=[];
 if(!(FACTOR_KEYS as readonly string[]).includes(e.factor))reasons.push("unregistered_factor");
 if(!Number.isFinite(e.value))reasons.push("nonfinite_value");
 if(!e.source.trim()||!e.subject.trim())reasons.push("missing_source_or_subject");
 if(!Number.isFinite(observation)||!Number.isFinite(availability)||observation>availability||availability>clock+30000)reasons.push("invalid_vintage");
 if(Number.isFinite(availability)&&clock-availability>ages[e.domain])reasons.push("stale_ingestion");
 if(e.factor==="implied_vol_atm"&&(e.value<=0||e.value>10))reasons.push("invalid_implied_volatility");
 if(e.factor==="iv_skew"&&Math.abs(e.value)>10)reasons.push("implausible_iv_skew");
 if(e.factor==="net_margin"&&Math.abs(e.value)>10000)reasons.push("implausible_net_margin");
 return {accepted:reasons.length===0,reasons,sourceVerified:false,calculationVerified:false,scientificallyCertified:false};
}
