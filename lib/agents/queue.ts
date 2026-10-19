import {AgentInvestigation,AgentResearchStatus,proposeInvestigationChange} from "./investigations";
export type InvestigationEvent={investigationId:string;at:string;actor:string;action:"created"|"evidence_added"|"status_proposed";details:string};
export function createInvestigation(input:{id:string;hypothesis:string;originalSource:string;createdAt:string}):AgentInvestigation{
 if(input.hypothesis.trim().length<5||input.hypothesis.length>1000)throw Error("Hypothesis length invalid");
 const source=new URL(input.originalSource);
 if(source.protocol!=="https:"||source.username||source.password)throw Error("Public HTTPS source required");
 if(!Number.isFinite(Date.parse(input.createdAt)))throw Error("Timestamp required");
 return {id:input.id,hypothesis:input.hypothesis.trim(),originalSource:source.toString(),createdAt:input.createdAt,status:"unverified",assignedAgents:[],evidence:[],decisions:[]};
}
export function proposeTransition(input:AgentInvestigation,next:AgentResearchStatus,reason:string,actor:string,at:string){
 if(!actor||!Number.isFinite(Date.parse(at)))return {allowed:false,reason:"Authenticated actor and timestamp required",next:null};
 const check=proposeInvestigationChange(input,next,reason);
 if(!check.allowed)return {...check,next:null};
 return {...check,next:{...input,status:next,decisions:[...input.decisions,{at,from:input.status,to:next,reason:reason.trim()}]}};
}
export const researchQueuePolicy={mode:"design_only",workersRunning:0,writeOperationsEnabled:false,operatorAuthenticationRequired:true,sourceClaimsVerified:false,modelsModified:false,ordersAllowed:false};
