import {secFundamentalsAsOf,secCatalystsWithStatus} from "../market/sec";
import {secMetaShareEvidence,valuationPriceReason,annualValuationInputUsable,type ShareResult} from "../market/sec-share-evidence";
import {db} from "../db";
import {bestSnapshots} from "../market/live";
import {alignedCashflowYield} from "./aligned-cashflow-yield";
export type FundamentalEvidence={factor:string;value:number;source:string;subject:string;observedAt:string;availableAt:string;metadata:Record<string,unknown>};

export type SecRatioDiagnostic={stage:string;reason:string;details?:Record<string,unknown>};
export async function secRatioEvidence(symbol:string,now=new Date()):Promise<FundamentalEvidence[]>{
 return (await secRatioEvidenceWithDiagnostics(symbol,now)).evidence;
}
export async function secRatioEvidenceWithDiagnostics(symbol:string,now=new Date()):Promise<{evidence:FundamentalEvidence[];diagnostics:SecRatioDiagnostic[]}>{
 const diagnostics:SecRatioDiagnostic[]=[];
 const current=now.toISOString();
 const filing=await secFundamentalsAsOf(symbol,current);
 if(filing.status!=="ok")return {evidence:[],diagnostics:[{stage:"company_facts",reason:filing.status}]};
 const v={...filing.values},p={...filing.provenance},results:FundamentalEvidence[]=[];
 let classShares:ShareResult|undefined;
 if(symbol.toUpperCase()==="META"){
  // META may not bypass class/corporate-action review via a new aggregate tag.
  classShares=await secMetaShareEvidence(current);
  delete v.shares;delete p.shares;
  if(classShares.observation&&!classShares.reason){
   v.shares=classShares.observation.shares;p.shares=classShares.observation;
  }else diagnostics.push({stage:"share_classes",reason:classShares.reason??"share_observation_missing",details:{observation:classShares.observation??null,blockingAccessions:classShares.blockingAccessions??[]}});
 }
 if(!(Number.isFinite(v.shares)&&v.shares>0))diagnostics.push({stage:"market_cap_ratios",reason:"current_common_shares_missing_or_invalid"});
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
  if(valuationPriceReason(price,observedAt,current,p.shares)){
   const market=await bestSnapshots([symbol.toUpperCase()]);
   const snap=market.snapshots[0];
   if(snap){price=snap.price;observedAt=snap.timestamp;priceSource=snap.source;}
  }
  const priceReason=valuationPriceReason(price,observedAt,current,p.shares)??(p.shares?null:"current_shares_provenance_missing");
  if(priceReason)diagnostics.push({stage:"market_cap_ratios",reason:priceReason});
  const shares=v.shares;
  if(!priceReason&&Number.isFinite(shares)&&shares>0&&Number.isFinite(price*shares)){
   const marketCap=price*shares;
   const source=`${priceSource} + SEC EDGAR XBRL`;
   const common={price,priceSource,priceObservedAt:observedAt,shares,sharesProvenance:p.shares,shareClassEvidence:classShares?.observation??null,marketCap,backtestEligible:false};
   const annualRevenue=v.annual_revenue,annualNet=v.annual_net_income;
   if(classShares)diagnostics.push({stage:"earnings_and_enterprise_valuation",reason:"META_TTM_common_earnings_and_preferred_debt_bridge_not_verified"});
   if(annualRevenue>0&&annualValuationInputUsable(annualRevenue,p.annual_revenue,observedAt)){
    results.push({factor:"price_sales",value:marketCap/annualRevenue,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,annualRevenue,annualRevenueProvenance:p.annual_revenue,unit:"ratio"}});
   }
   if(!classShares&&annualNet>0&&annualValuationInputUsable(annualNet,p.annual_net_income,observedAt)){
    results.push({factor:"pe_trailing",value:marketCap/annualNet,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,annualNetIncome:annualNet,annualNetIncomeProvenance:p.annual_net_income,unit:"ratio"}});
   }
   const cfo=v.annual_operating_cash_flow,capex=v.annual_capex;
   const cashflow=alignedCashflowYield({value:cfo,provenance:p.annual_operating_cash_flow},{value:capex,provenance:p.annual_capex},marketCap);
   if(cashflow&&annualValuationInputUsable(cfo,p.annual_operating_cash_flow,observedAt)&&annualValuationInputUsable(capex,p.annual_capex,observedAt)){
    results.push({factor:"free_cash_flow_yield",value:cashflow.value,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,operatingCashFlow:cfo,capex,freeCashFlow:cashflow.freeCashFlow,cfoProvenance:p.annual_operating_cash_flow,capexProvenance:p.annual_capex,unit:"fraction",method:"same_annual_period_and_accession_cashflow_yield_v2"}});
   }
   else diagnostics.push({stage:"free_cash_flow_yield",reason:"cashflow_inputs_missing_invalid_or_unaligned"});
   const operatingIncome=v.annual_operating_income,da=v.annual_depreciation_amortization,cash=v.cash_and_equivalents;
   const debtParts=[v.debt_current,v.debt_noncurrent].filter(Number.isFinite) as number[];
   if(!classShares&&Number.isFinite(operatingIncome)&&Number.isFinite(da)&&Number.isFinite(cash)&&debtParts.length){
    const ebitda=operatingIncome+da,totalDebt=debtParts.reduce((sum,x)=>sum+x,0),enterpriseValue=marketCap+totalDebt-cash;
    if(ebitda>0&&enterpriseValue>0&&p.annual_operating_income&&p.annual_depreciation_amortization&&p.cash_and_equivalents){
     results.push({factor:"ev_ebitda",value:enterpriseValue/ebitda,source,subject:symbol,observedAt,availableAt:current,metadata:{...common,enterpriseValue,marketCap,totalDebt,cash,ebitda,operatingIncome,depreciationAmortization:da,operatingIncomeProvenance:p.annual_operating_income,depreciationProvenance:p.annual_depreciation_amortization,cashProvenance:p.cash_and_equivalents,debtCurrentProvenance:p.debt_current??null,debtNoncurrentProvenance:p.debt_noncurrent??null,unit:"ratio",method:"market_cap_plus_reported_debt_minus_cash_divided_by_annual_operating_income_plus_DA"}});
    }
   }
   const eqNow=v.equity_annual_end,eqPrior=v.equity_prior_annual_end;
   if(Number.isFinite(annualNet)&&Number.isFinite(eqNow)&&Number.isFinite(eqPrior)){
    const avg=(eqNow+eqPrior)/2;
    if(avg!==0&&p.equity_annual_end&&p.equity_prior_annual_end)results.push({factor:"return_on_equity",value:annualNet/avg,source:"SEC EDGAR XBRL",subject:symbol,observedAt:p.annual_net_income.filed+"T00:00:00Z",availableAt:current,metadata:{annualNetIncome:annualNet,equityEnd:eqNow,equityPriorEnd:eqPrior,netIncomeProvenance:p.annual_net_income,equityEndProvenance:p.equity_annual_end,equityPriorProvenance:p.equity_prior_annual_end,unit:"fraction",backtestEligible:false}});
   }
  }
 }catch{diagnostics.push({stage:"valuation_collection",reason:"collection_failed"});}
 try{
  const {catalysts,statuses}=await secCatalystsWithStatus([symbol],100);
  const cutoff=now.getTime()-30*86400000;
  const forms=catalysts.filter(x=>x.form==="4"&&x.acceptedAt&&Number.isFinite(Date.parse(x.acceptedAt))&&Date.parse(x.acceptedAt)>=cutoff&&Date.parse(x.acceptedAt)<=now.getTime());
  if(forms.length){
   const latest=forms.map(x=>x.acceptedAt!).sort().at(-1)!;
   results.push({factor:"insider_trading",value:forms.length,source:"SEC EDGAR submissions",subject:symbol,observedAt:latest,availableAt:current,metadata:{windowDays:30,method:"count_of_SEC_Form_4_filings",filingIds:forms.map(x=>x.id),sourceStatuses:statuses,note:"Measures disclosed Form 4 filing activity only; does not infer buy/sell direction or economic significance.",backtestEligible:false}});
  }
 }catch{diagnostics.push({stage:"insider_activity",reason:"collection_failed"});}
 // Current retrieval cannot establish that newly fetched facts were available
 // when the request began. Preserve request timing separately from receipt.
 const receivedAt=new Date().toISOString();
 return {evidence:results.map(result=>({...result,availableAt:receivedAt,metadata:{...result.metadata,requestedAt:current,timestampKind:"retrieval_completion_not_original_publication"}})),diagnostics};
}
