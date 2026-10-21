import {secFundamentalsAsOf,secCatalystsWithStatus} from "../market/sec";
import {db} from "../db";
import {bestSnapshots} from "../market/live";
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
 for(const [factor,currentKey,priorKey] of [["revenue_growth","revenue","revenue_prior_year"],["earnings_growth","net_income","net_income_prior_year"]] as const){
  const recent=p[currentKey],prior=p[priorKey],numerator=v[currentKey],denominator=v[priorKey];
  if(!recent?.filed||!prior?.filed||!Number.isFinite(numerator)||!Number.isFinite(denominator)||denominator<=0)continue;
  const ratio=numerator/denominator-1;
  if(!Number.isFinite(ratio))continue;
  const filingDate=[recent.filed,prior.filed].sort().at(-1)!;
  results.push({factor,value:ratio,source:"SEC EDGAR XBRL",subject:symbol,observedAt:filingDate+"T00:00:00Z",availableAt:current,metadata:{current:recent,priorYear:prior,unit:"fraction",backtestEligible:false}});
 }

 try{
  const sql=db();
  const rows=await sql`select source_id,event_time,metadata from source_observations
    where symbol=${symbol.toUpperCase()} and data_class='market_snapshot'
    order by received_at desc limit 1`;
  const row=rows[0];
  let price=Number((row?.metadata as any)?.price);
  let observedAt=row?new Date(row.event_time as string).toISOString():"";
  let priceSource=row?String(row.source_id):"";
  if(!(Number.isFinite(price)&&price>0&&observedAt)){
   const market=await bestSnapshots([symbol.toUpperCase()]);
   const snap=market.snapshots[0];
   if(snap){price=snap.price;observedAt=snap.timestamp;priceSource=snap.source;}
  }
  const shares=v.shares;
  if(Number.isFinite(price)&&price>0&&observedAt&&Number.isFinite(shares)&&shares>0){
   const marketCap=price*shares;
   const source=`${priceSource} + SEC EDGAR XBRL`;
   const common={price,priceSource,priceObservedAt:observedAt,shares,sharesProvenance:p.shares,backtestEligible:false};
   const annualRevenue=v.annual_revenue,annualNet=v.annual_net_income;
   if(Number.isFinite(annualRevenue)&&annualRevenue>0&&p.annual_revenue){
    results.push({factor:"price_sales",value:marketCap/annualRevenue,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,annualRevenue,annualRevenueProvenance:p.annual_revenue,unit:"ratio"}});
   }
   if(Number.isFinite(annualNet)&&annualNet>0&&p.annual_net_income){
    results.push({factor:"pe_trailing",value:marketCap/annualNet,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,annualNetIncome:annualNet,annualNetIncomeProvenance:p.annual_net_income,unit:"ratio"}});
   }
   const cfo=v.annual_operating_cash_flow,capex=v.annual_capex;
   if(Number.isFinite(cfo)&&Number.isFinite(capex)&&marketCap>0&&p.annual_operating_cash_flow&&p.annual_capex){
    const fcf=cfo-Math.abs(capex);
    if(Number.isFinite(fcf))results.push({factor:"free_cash_flow_yield",value:fcf/marketCap,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,operatingCashFlow:cfo,capex,freeCashFlow:fcf,cfoProvenance:p.annual_operating_cash_flow,capexProvenance:p.annual_capex,unit:"fraction"}});
   }
   const eqNow=v.equity_annual_end,eqPrior=v.equity_prior_annual_end;
   if(Number.isFinite(annualNet)&&Number.isFinite(eqNow)&&Number.isFinite(eqPrior)){
    const avg=(eqNow+eqPrior)/2;
    if(avg!==0&&p.equity_annual_end&&p.equity_prior_annual_end)results.push({factor:"return_on_equity",value:annualNet/avg,source:"SEC EDGAR XBRL",subject:symbol,observedAt:p.annual_net_income.filed+"T00:00:00Z",availableAt:current,metadata:{annualNetIncome:annualNet,equityEnd:eqNow,equityPriorEnd:eqPrior,netIncomeProvenance:p.annual_net_income,equityEndProvenance:p.equity_annual_end,equityPriorProvenance:p.equity_prior_annual_end,unit:"fraction",backtestEligible:false}});
   }
  }
 }catch{}
 try{
  const {catalysts,statuses}=await secCatalystsWithStatus([symbol],100);
  const cutoff=now.getTime()-30*86400000;
  const forms=catalysts.filter(x=>x.form==="4"&&x.acceptedAt&&Number.isFinite(Date.parse(x.acceptedAt))&&Date.parse(x.acceptedAt)>=cutoff&&Date.parse(x.acceptedAt)<=now.getTime());
  if(forms.length){
   const latest=forms.map(x=>x.acceptedAt!).sort().at(-1)!;
   results.push({factor:"insider_trading",value:forms.length,source:"SEC EDGAR submissions",subject:symbol,observedAt:latest,availableAt:current,metadata:{windowDays:30,method:"count_of_SEC_Form_4_filings",filingIds:forms.map(x=>x.id),sourceStatuses:statuses,note:"Measures disclosed Form 4 filing activity only; does not infer buy/sell direction or economic significance.",backtestEligible:false}});
  }
 }catch{}
 return results;
}
