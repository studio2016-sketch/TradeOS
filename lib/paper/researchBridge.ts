import {evaluatePaperCandidate} from "./integrated";
import type {PaperOrder,PaperQuote} from "./simulator";
import type {PortfolioRiskInput} from "./portfolioRisk";
export type ResearchInput={alignment:{executionAuthorization?:{allowed?:boolean};canonical?:{availability?:number};buyState?:string;supervisors?:{buyVeto?:boolean}}|null;quote:PaperQuote|null;order:PaperOrder;portfolio:PortfolioRiskInput;dataProvenance:"verified_observation"|"synthetic"|"unverified";marketAgeMs:number|null};
export function researchToPaper(input:ResearchInput,nowMs=Date.now()){
 const blockers:string[]=[];
 const a=input.alignment;
 if(!a)blockers.push("No alignment assessment");
 if(a?.supervisors?.buyVeto)blockers.push("Alignment supervisor veto");
 if(a?.canonical?.availability===undefined||a.canonical.availability<75)blockers.push("Insufficient observed alignment factors");
 if(!["READY","HIGH CONVICTION","MUST BUY"].includes(a?.buyState||""))blockers.push("No research candidate state");
 if(input.dataProvenance!=="verified_observation")blockers.push("Synthetic or unverified market evidence");
 if(input.marketAgeMs===null||input.marketAgeMs<0||input.marketAgeMs>60000)blockers.push("Market observation not current");
 if(blockers.length)return {status:"research_blocked" as const,blockers,simulation:null,liveAuthorized:false};
 const simulation=evaluatePaperCandidate(input.order,input.quote,input.portfolio,nowMs);
 return {status:simulation.status==="simulated_fill"?"paper_simulated" as const:"research_blocked" as const,blockers:simulation.risk.blockers,simulation,liveAuthorized:false};
}
