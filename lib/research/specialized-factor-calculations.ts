/**
 * Pure, deterministic specialized factor calculations.
 * These functions do not establish provider permission or source-time provenance.
 * Callers MUST validate licensed, point-in-time inputs before persisting evidence.
 */
export type AsOfValue={value:number;availableAt:string};
const finite=(x:number)=>Number.isFinite(x);
export function availableAtDecision(x:AsOfValue,decisionAt:string){
 const a=Date.parse(x.availableAt),d=Date.parse(decisionAt);
 return finite(x.value)&&finite(a)&&finite(d)&&a<=d;
}
export function forwardPE(price:AsOfValue,forwardEps:AsOfValue,decisionAt:string):number|null{
 if(!availableAtDecision(price,decisionAt)||!availableAtDecision(forwardEps,decisionAt)||forwardEps.value<=0||price.value<=0)return null;
 return price.value/forwardEps.value;
}
export function estimateRevision(previous:AsOfValue,current:AsOfValue,decisionAt:string):number|null{
 if(!availableAtDecision(previous,decisionAt)||!availableAtDecision(current,decisionAt)||Date.parse(previous.availableAt)>=Date.parse(current.availableAt)||previous.value===0)return null;
 return (current.value-previous.value)/Math.abs(previous.value)*100;
}
export function ivRank(current:AsOfValue,history:AsOfValue[],decisionAt:string):number|null{
 if(!availableAtDecision(current,decisionAt)||history.length<252||history.some(x=>!availableAtDecision(x,decisionAt)||Date.parse(x.availableAt)>Date.parse(current.availableAt)))return null;
 const values=history.map(x=>x.value),low=Math.min(...values),high=Math.max(...values);
 if(low<0||current.value<0||high<=low)return null;
 return Math.max(0,Math.min(100,(current.value-low)/(high-low)*100));
}
export type Position={symbol:string;sector:string;marketValue:number;annualVolatility?:number};
export type PortfolioSnapshot={equity:number;positions:Position[];availableAt:string};
export function portfolioRiskFactors(p:PortfolioSnapshot,decisionAt:string,maxGrossPct:number,maxSectorPct:number,maxDailyLoss:number,dailyRealizedPnl:number){
 if(!finite(p.equity)||p.equity<=0||!finite(maxGrossPct)||maxGrossPct<=0||!finite(maxSectorPct)||maxSectorPct<=0||!finite(maxDailyLoss)||maxDailyLoss<=0||!finite(dailyRealizedPnl)||!finite(Date.parse(p.availableAt))||Date.parse(p.availableAt)>Date.parse(decisionAt)||p.positions.some(x=>!x.symbol||!x.sector||!finite(x.marketValue)||x.marketValue<0))return null;
 const gross=p.positions.reduce((n,x)=>n+Math.abs(x.marketValue),0);
 const byName=new Map<string,number>(),bySector=new Map<string,number>();
 for(const x of p.positions){byName.set(x.symbol,(byName.get(x.symbol)??0)+Math.abs(x.marketValue));bySector.set(x.sector,(bySector.get(x.sector)??0)+Math.abs(x.marketValue));}
 const positionVolatility=p.positions.every(x=>x.annualVolatility!==undefined&&finite(x.annualVolatility)&&x.annualVolatility>=0)?
  p.positions.reduce((sum,x)=>sum+Math.pow(x.marketValue/p.equity,2)*Math.pow(x.annualVolatility!,2),0)**0.5:null;
 // Volatility here is a diagonal-only approximation, NOT portfolio covariance.
 return {portfolio_exposure:gross/p.equity*100,
  single_name_weight:(byName.size?Math.max(...byName.values()):0)/p.equity*100,
  sector_concentration:(bySector.size?Math.max(...bySector.values()):0)/p.equity*100,
  position_volatility:positionVolatility,
  risk_budget_remaining:Math.max(0,maxDailyLoss+Math.min(0,dailyRealizedPnl))};
}
