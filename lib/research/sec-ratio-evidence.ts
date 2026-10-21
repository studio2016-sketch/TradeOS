import {secFundamentalsAsOf} from "../market/sec";
export type FundamentalEvidence={factor:string;value:number;source:string;subject:string;observedAt:string;availableAt:string;metadata:Record<string,unknown>};
export async function secRatioEvidence(symbol:string,now=new Date()):Promise<FundamentalEvidence[]>{
 const current=now.toISOString();
 const filing=await secFundamentalsAsOf(symbol,current);
 if(filing.status!=="ok")return [];
 const v=filing.values,p=filing.provenance,results:FundamentalEvidence[]=[];
 const rev=p.revenue,net=p.net_income;
 if(Number.isFinite(v.revenue)&&v.revenue>0&&Number.isFinite(v.net_income)&&rev?.end===net?.end&&rev?.start===net?.start&&rev?.accession===net?.accession){
  const ratio=v.net_income/v.revenue;
  if(Number.isFinite(ratio)){
   const lastFiled=[rev.filed,net.filed].sort().at(-1)!;
   results.push({factor:"net_margin",value:ratio,source:"SEC EDGAR XBRL",subject:symbol,observedAt:lastFiled+"T00:00:00Z",availableAt:current,metadata:{netIncome:net,revenue:rev,unit:"fraction",backtestEligible:false}});
  }
 }
 return results;
}
