import {alpacaBrokerState} from "../broker/alpaca";
import {historicalBars} from "../market/features";
import {calculatePortfolioRiskFactors,type PortfolioPositionInput} from "./portfolio-factor-engine";
import type {PersistableEvidence} from "./persist-evidence";

function dailyReturns(bars:Array<{t:string;c:number}>){
 const ordered=[...bars].filter(b=>Number.isFinite(Date.parse(b.t))&&Number.isFinite(b.c)&&b.c>0).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 const out:Record<string,number>={};
 for(let i=1;i<ordered.length;i++)out[ordered[i].t.slice(0,10)]=ordered[i].c/ordered[i-1].c-1;
 return out;
}

export async function observedPortfolioFactorEvidence(now=new Date()){
 const account=await alpacaBrokerState();
 if(!account||account.equity===null||account.equity<=0)return {candidates:[] as PersistableEvidence[],status:"account_unavailable",diagnostics:[]};
 const equity=account.equity;
 if(!account.positions.length)return {candidates:[] as PersistableEvidence[],status:"empty_portfolio",diagnostics:[]};
 if(account.positions.length>30)return {candidates:[] as PersistableEvidence[],status:"position_limit_exceeded",diagnostics:[{positions:account.positions.length,limit:30}]};
 const feed=process.env.ALPACA_FEED||"iex",end=now.toISOString(),start=new Date(now.getTime()-420*86400000).toISOString();
 const results=await Promise.all(account.positions.map(async position=>{
  try{
   const bars=await historicalBars(position.symbol,"1Day",start,500,feed,end);
   const completed=bars.filter(bar=>bar.t.slice(0,10)<end.slice(0,10));
   return {input:{symbol:position.symbol,marketValue:position.marketValue,returns:dailyReturns(completed)} satisfies PortfolioPositionInput,diagnostic:{symbol:position.symbol,bars:completed.length}};
  }catch(error){return {input:null,diagnostic:{symbol:position.symbol,error:error instanceof Error?error.message:"history_unavailable"}};}
 }));
 const inputs=results.flatMap(result=>result.input?[result.input]:[]),diagnostics=results.map(result=>result.diagnostic);
 if(inputs.length!==account.positions.length)return {candidates:[] as PersistableEvidence[],status:"incomplete_position_history",diagnostics};
 const factors=calculatePortfolioRiskFactors(equity,inputs),availableAt=new Date().toISOString(),observedAt=account.generatedAt;
 const source=`Alpaca ${account.environment} account + Alpaca:${feed}:1Day`;
 const composition=inputs.map(p=>({symbol:p.symbol,weight:p.marketValue/equity,returnDates:Object.keys(p.returns).length}));
 const candidates:PersistableEvidence[]=Object.entries(factors).flatMap(([factor,result])=>result.value===null?[]:[{
  factor,value:result.value,source,subject:`${account.environment.toUpperCase()}_PORTFOLIO`,observedAt,availableAt,domain:"portfolio" as const,
  metadata:{method:factor==="portfolio_exposure"?"sum_absolute_market_value_over_equity":factor==="single_name_weight"?"maximum_absolute_position_market_value_over_equity":factor==="position_volatility"?"annualized_sample_volatility_of_constant_current_weight_synchronized_daily_returns":factor==="var_95"?"empirical_5th_percentile_loss_of_constant_current_weight_returns":factor==="expected_shortfall"?"mean_loss_at_or_below_empirical_5th_percentile":"maximum_drawdown_of_constant_current_weight_return_path",inputCount:result.inputCount,positionCount:inputs.length,composition,environment:account.environment,feed,note:"Current-position constant-weight research diagnostic; not a historical holdings backtest or predictive certificate."}
 }]);
 return {candidates,status:"measured_uncertified",diagnostics};
}
