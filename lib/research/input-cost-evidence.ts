import {fredSeriesHistory} from "../market/fred";
import type {PersistableEvidence} from "./persist-evidence";

export function standardizedLatestChange(values:number[]){
 if(values.length<14)return null;
 const changes:number[]=[];
 for(let i=1;i<values.length;i++)if(Number.isFinite(values[i-1])&&values[i-1]!==0&&Number.isFinite(values[i]))changes.push(values[i]/values[i-1]-1);
 if(changes.length<13)return null;
 const current=changes.at(-1)!;
 const history=changes.slice(0,-1).slice(-24);
 if(history.length<12)return null;
 const mean=history.reduce((a,b)=>a+b,0)/history.length;
 const variance=history.reduce((s,x)=>s+(x-mean)**2,0)/history.length;
 const sd=Math.sqrt(variance);
 if(!(sd>0))return null;
 const z=(current-mean)/sd;
 return Number.isFinite(z)?{z,currentChange:current,mean,sd,historyCount:history.length}:null;
}

export async function observedInputCostShock(now=new Date()){
 const availableAt=now.toISOString();
 const result=await fredSeriesHistory("PPIACO",1200);
 if(result.status!=="ok"||result.points.length<14)return {retrievedAt:availableAt,candidates:[] as PersistableEvidence[],status:result.status,error:result.error??null};
 const derived=standardizedLatestChange(result.points.map(p=>p.value));
 const latest=result.points.at(-1);
 if(!derived||!latest)return {retrievedAt:availableAt,candidates:[] as PersistableEvidence[],status:"insufficient_history",error:null};
 const candidate:PersistableEvidence={
  factor:"input_cost_shock",value:derived.z,source:"FRED:PPIACO / U.S. Bureau of Labor Statistics",
  subject:"US_COMMODITY_INPUTS",observedAt:latest.date+"T00:00:00Z",availableAt,domain:"macro",
  metadata:{method:"z_score_of_latest_monthly_PPI_all_commodities_change_vs_prior_up_to_24_months",unit:"standard_deviations",currentChange:derived.currentChange,historyMean:derived.mean,historySd:derived.sd,historyCount:derived.historyCount,series:"PPIACO",backtestEligible:false}
 };
 return {retrievedAt:availableAt,candidates:[candidate],status:"measured",error:null};
}
