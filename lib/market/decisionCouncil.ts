import type {AlignmentResult} from "../alignment/engine";
import type {SupervisoryResult} from "../alignment/supervisors";
import {observedAgeMs} from "./freshness";

type CouncilVerdict="SUPPORTS_RESEARCH"|"OPPOSES_RESEARCH"|"INSUFFICIENT_EVIDENCE";
type CouncilMember={role:string;verdict:CouncilVerdict;reason:string;evidence:string[]};
export interface DecisionCouncil{
 version:"research-council-v1";symbol:string;generatedAt:string;
 recommendation:"WATCH"|"PASS"|"RESEARCH_CANDIDATE";executionAllowed:false;
 sourceQuote:{provider:string|null;priceObservedAt:string|null;quoteObservedAt:string|null;priceAgeMs:number|null;quoteAgeMs:number|null;usableIntraday:boolean};
 estimatedWinProbability:null;probabilityReliability:"NOT_VALIDATED";dataQuality:"UNAVAILABLE"|"DEGRADED"|"OBSERVED";
 council:CouncilMember[];bullCase:string[];bearCase:string[];vetoes:string[];disagreementCount:number;note:string;
}
/**
 * Research council is intentionally deterministic and traceable to evidence.
 * Multiple modeled viewpoints are not independent agents, nor proof of predictive performance.
 */
export function evaluateDecisionCouncil(args:{
 alignment:AlignmentResult;supervisors:SupervisoryResult;
 marketSnapshot?:{source?:string;timestamp?:string;quoteTimestamp?:string;price?:number}|null;
 intradayLastObserved?:string|null;
 independentOutOfSampleVerified?:boolean;
}, now=Date.now()):DecisionCouncil{
 const {alignment,supervisors,marketSnapshot:s}=args;
 const priceAge=observedAgeMs(s?.timestamp,now);
 const quoteAge=observedAgeMs(s?.quoteTimestamp,now);
 const barAge=observedAgeMs(args.intradayLastObserved,now);
 const freshMarket=Boolean(s&&Number(s.price)>0&&priceAge!==null&&priceAge<=60000);
 const freshHistory=barAge!==null&&barAge<=20*60000;
 const available=alignment.readings.filter(r=>r.buyScore!=null);
 const positive=available.filter(r=>r.buyScore!==null&&r.buyScore>=75).sort((a,b)=>(b.buyScore??0)-(a.buyScore??0));
 const negative=available.filter(r=>r.buyScore!==null&&r.buyScore<50).sort((a,b)=>(a.buyScore??0)-(b.buyScore??0));
 const vetoes:string[]=[];
 if(!freshMarket)vetoes.push("Latest price observation is unavailable or older than 60 seconds.");
 if(!freshHistory)vetoes.push("Intraday indicators have no confirmed candle within 20 minutes.");
 if(supervisors.buyVeto)vetoes.push("Independent supervisory risk veto active.");
 if(alignment.availability<75)vetoes.push("Less than 75% of required market evidence is available.");
 if(!args.independentOutOfSampleVerified)vetoes.push("Predictive model lacks independent point-in-time out-of-sample validation.");
 const bullCase=positive.slice(0,5).map(r=>r.label+" ("+Math.round(r.buyScore!)+"/100; "+r.source+")");
 const bearCase=negative.slice(0,5).map(r=>r.label+" ("+Math.round(r.buyScore!)+"/100; "+r.source+")");
 const members:CouncilMember[]=[
  {role:"Opportunity Analyst",verdict:positive.length>=4?"SUPPORTS_RESEARCH":"INSUFFICIENT_EVIDENCE",reason:positive.length+" available factors show stronger supporting observations.",evidence:bullCase},
  {role:"Skeptical Analyst",verdict:negative.length>=3?"OPPOSES_RESEARCH":"INSUFFICIENT_EVIDENCE",reason:negative.length+" weak factors require scrutiny; missing factors are not positive evidence.",evidence:bearCase},
  {role:"Market Strategist",verdict:alignment.availability>=75?"SUPPORTS_RESEARCH":"INSUFFICIENT_EVIDENCE",reason:"Market evidence availability: "+alignment.availability.toFixed(1)+"%.",evidence:available.filter(r=>r.group==="Market Regime").slice(0,4).map(r=>r.label+": "+r.state)},
  {role:"Quantitative Analyst",verdict:"INSUFFICIENT_EVIDENCE",reason:"Historical scores are not calibrated probabilities; independent out-of-sample validation is required.",evidence:["Win probability withheld rather than invented."]},
  {role:"Risk Director",verdict:vetoes.length?"OPPOSES_RESEARCH":"SUPPORTS_RESEARCH",reason:vetoes.length?vetoes.join(" "):"Current data and supervisory guards pass.",evidence:supervisors.supervisors.filter(x=>x.buyVeto).map(x=>x.label+": "+x.note)},
  {role:"Execution Specialist",verdict:freshMarket&&freshHistory?"SUPPORTS_RESEARCH":"INSUFFICIENT_EVIDENCE",reason:"Latest source price age: "+(priceAge===null?"unknown":Math.round(priceAge/1000)+"s")+"; latest intraday bar age: "+(barAge===null?"unknown":Math.round(barAge/60000)+"m")+".",evidence:[s?.source??"Market provider unavailable"]},
  {role:"Chief Decision Officer",verdict:vetoes.length?"OPPOSES_RESEARCH":"SUPPORTS_RESEARCH",reason:"Research classification is subordinate to all source, execution and risk vetoes. No live order authorization.",evidence:vetoes}
 ];
 const recommendation:"PASS"|"WATCH"|"RESEARCH_CANDIDATE"=vetoes.length?"PASS":negative.length>=3?"WATCH":positive.length>=4?"RESEARCH_CANDIDATE":"WATCH";
 return {version:"research-council-v1",symbol:alignment.symbol,generatedAt:new Date(now).toISOString(),recommendation,executionAllowed:false,
 sourceQuote:{provider:s?.source??null,priceObservedAt:s?.timestamp??null,quoteObservedAt:s?.quoteTimestamp??null,priceAgeMs:priceAge,quoteAgeMs:quoteAge,usableIntraday:freshMarket&&freshHistory},
 estimatedWinProbability:null,probabilityReliability:"NOT_VALIDATED",dataQuality:!s?"UNAVAILABLE":freshMarket&&freshHistory?"OBSERVED":"DEGRADED",
 council:members,bullCase,bearCase,vetoes,disagreementCount:members.filter(m=>m.verdict==="OPPOSES_RESEARCH").length,
 note:"Deterministic evidence review, not seven independent AI forecasters. No validated win probability or live execution authorization."};
}
