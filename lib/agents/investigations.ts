export type AgentResearchStatus="unverified"|"investigating"|"challenged"|"testing"|"rejected"|"certification_review";
export type EvidenceRecord={sourceUrl:string;observedAt:string;finding:string;kind:"support"|"contradiction"|"missing";independent:boolean};
export type AgentInvestigation={id:string;hypothesis:string;originalSource:string;createdAt:string;status:AgentResearchStatus;assignedAgents:string[];evidence:EvidenceRecord[];decisions:Array<{at:string;from:AgentResearchStatus;to:AgentResearchStatus;reason:string}>};
const allowed:Record<AgentResearchStatus,AgentResearchStatus[]>={
 unverified:["investigating","rejected"],investigating:["challenged","rejected"],
 challenged:["testing","rejected"],testing:["certification_review","rejected"],
 rejected:[],certification_review:["rejected"]
};
export function proposeInvestigationChange(item:AgentInvestigation,to:AgentResearchStatus,reason:string){
 if(!allowed[item.status].includes(to))return {allowed:false,reason:"Invalid research lifecycle transition"};
 if(!reason.trim()||reason.length<15)return {allowed:false,reason:"Document a substantive reason"};
 if(to==="certification_review"){
  const independent=item.evidence.some(e=>e.independent&&e.kind==="support");
  const challenge=item.evidence.some(e=>e.kind==="contradiction");
  if(!independent||!challenge)return {allowed:false,reason:"Independent positive evidence and opposing review required"};
 }
 return {allowed:true,reason:"Eligible for authorized human review only"};
}
export const investigationSafety={
 externalContent:"untrusted_data_only",externalInstructionExecution:false,
 liveOrdersAllowed:false,automaticModelPromotion:false,
 databaseWritesEnabled:false,autonomousWorkersEnabled:false,
 policy:"No lifecycle transition directly produces a certified trading model."
} as const;
