export type PortfolioPositionInput={symbol:string;marketValue:number;returns:Record<string,number>};
export type PortfolioFactorResult={value:number|null;inputCount:number;reason?:string};
export type PortfolioFactorOutput={
 portfolio_exposure:PortfolioFactorResult;single_name_weight:PortfolioFactorResult;
 position_volatility:PortfolioFactorResult;var_95:PortfolioFactorResult;
 expected_shortfall:PortfolioFactorResult;max_drawdown:PortfolioFactorResult;
};
const unavailable=(reason:string,inputCount=0):PortfolioFactorResult=>({value:null,inputCount,reason});
const measured=(value:number,inputCount:number):PortfolioFactorResult=>Number.isFinite(value)?{value,inputCount}:unavailable("non_finite_result",inputCount);

/** Constant-current-weight research diagnostics; no historical holding path is implied. */
export function calculatePortfolioRiskFactors(equity:number,raw:PortfolioPositionInput[]):PortfolioFactorOutput{
 const empty={portfolio_exposure:unavailable("portfolio_unavailable"),single_name_weight:unavailable("portfolio_unavailable"),position_volatility:unavailable("portfolio_unavailable"),var_95:unavailable("portfolio_unavailable"),expected_shortfall:unavailable("portfolio_unavailable"),max_drawdown:unavailable("portfolio_unavailable")};
 if(!Number.isFinite(equity)||equity<=0)return empty;
 const positions=raw.filter(p=>/^[A-Z0-9.-]{1,10}$/.test(p.symbol)&&Number.isFinite(p.marketValue)&&p.marketValue!==0);
 if(!positions.length)return empty;
 const weights=positions.map(p=>p.marketValue/equity),gross=weights.reduce((sum,w)=>sum+Math.abs(w),0),largest=Math.max(...weights.map(Math.abs));
 const dateSets=positions.map(p=>new Set(Object.entries(p.returns).filter(([date,value])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(value)).map(([date])=>date)));
 const dates=[...dateSets[0]].filter(date=>dateSets.every(set=>set.has(date))).sort();
 const portfolioReturns=dates.map(date=>positions.reduce((sum,p,i)=>sum+weights[i]*p.returns[date],0)).filter(Number.isFinite);
 const base={portfolio_exposure:measured(gross,positions.length),single_name_weight:measured(largest,positions.length)};
 if(portfolioReturns.length<20)return {...base,position_volatility:unavailable("insufficient_synchronized_returns",portfolioReturns.length),var_95:unavailable("insufficient_synchronized_returns",portfolioReturns.length),expected_shortfall:unavailable("insufficient_synchronized_returns",portfolioReturns.length),max_drawdown:unavailable("insufficient_synchronized_returns",portfolioReturns.length)};
 const mean=portfolioReturns.reduce((sum,x)=>sum+x,0)/portfolioReturns.length;
 const variance=portfolioReturns.reduce((sum,x)=>sum+(x-mean)**2,0)/(portfolioReturns.length-1);
 const sorted=[...portfolioReturns].sort((a,b)=>a-b),threshold=sorted[Math.floor(.05*(sorted.length-1))];
 const tail=sorted.filter(x=>x<=threshold),var95=Math.max(0,-threshold),expectedShortfall=Math.max(0,-tail.reduce((sum,x)=>sum+x,0)/tail.length);
 let wealth=1,peak=1,maxDrawdown=0;
 for(const value of portfolioReturns){wealth*=1+value;peak=Math.max(peak,wealth);if(peak>0)maxDrawdown=Math.max(maxDrawdown,(peak-wealth)/peak);}
 return{...base,position_volatility:measured(Math.sqrt(variance)*Math.sqrt(252),portfolioReturns.length),var_95:measured(var95,portfolioReturns.length),expected_shortfall:measured(expectedShortfall,portfolioReturns.length),max_drawdown:measured(maxDrawdown,portfolioReturns.length)};
}
