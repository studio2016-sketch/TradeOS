import type {BrokerAccountState} from "../broker/alpaca";
export interface PortfolioReconciliation{
 status:"PASS"|"REVIEW"|"UNAVAILABLE";environment:"live"|"paper";generatedAt:string;
 checks:Array<{id:string;state:"PASS"|"REVIEW"|"UNAVAILABLE";difference:number|null;tolerance:number|null;description:string}>;
 positionCount:number;openOrderCount:number;noTransactionsReconciled:true;
}
/**
 * Read-only account snapshot consistency checks. These are NOT a reconciliation
 * of fills, deposits, withdrawals, transfers, splits, fees, margin or realized P&L.
 * Never publishes account or position identifiers.
 */
export function reconcileAccountSnapshot(a:BrokerAccountState):PortfolioReconciliation{
 const checks:PortfolioReconciliation["checks"]=[];
 const compare=(id:string,left:number|null,right:number|null,description:string,tolerance=.02)=>{
  if(left===null||right===null||!Number.isFinite(left)||!Number.isFinite(right)){checks.push({id,state:"UNAVAILABLE",difference:null,tolerance:null,description});return}
  const difference=Math.round((left-right)*100)/100;
  checks.push({id,state:Math.abs(difference)<=tolerance?"PASS":"REVIEW",difference,tolerance,description});
 };
 compare("reported_equity_vs_portfolio_value",a.equity,a.portfolioValue,"Alpaca account equity versus Alpaca portfolio value");
 const positionMV=a.positions.filter(x=>Number.isFinite(x.marketValue)).reduce((s,x)=>s+x.marketValue,0);
 if(a.positions.every(x=>Number.isFinite(x.marketValue))){
  compare("cash_plus_marked_positions_vs_reported_equity",a.cash===null?null:a.cash+positionMV,a.equity,"Approximate mark-to-market identity; margin/shorts/accruals may legitimately cause differences",1);
 }else checks.push({id:"cash_plus_marked_positions_vs_reported_equity",state:"UNAVAILABLE",difference:null,tolerance:null,description:"Position market values missing"});
 const long=a.positions.filter(p=>p.side==="long");
 const missing=long.some(p=>![p.marketValue,p.costBasis,p.unrealizedPl].every(Number.isFinite));
 if(!missing){
  const difference=long.reduce((sum,p)=>sum+(p.marketValue-p.costBasis-p.unrealizedPl),0);
  checks.push({id:"long_unrealized_pl_identity",state:Math.abs(difference)<=Math.max(.02,long.length*.02)?"PASS":"REVIEW",difference:+difference.toFixed(2),tolerance:Math.max(.02,long.length*.02),description:"Aggregate long unrealized P&L compared with market value minus cost basis"});
 }else checks.push({id:"long_unrealized_pl_identity",state:"UNAVAILABLE",difference:null,tolerance:null,description:"Long position data incomplete"});
 return {status:checks.some(x=>x.state==="REVIEW")?"REVIEW":checks.some(x=>x.state==="UNAVAILABLE")?"UNAVAILABLE":"PASS",environment:a.environment,generatedAt:new Date().toISOString(),checks,positionCount:a.positions.length,openOrderCount:a.openOrders.length,noTransactionsReconciled:true};
}
