import {NextResponse} from "next/server";
import {authorizeIngest} from "../../../lib/security";
import {hasDatabase} from "../../../lib/db";
import {alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";
import {portfolioRiskFactors} from "../../../lib/research/specialized-factor-calculations";
import {persistEvidence,type PersistableEvidence} from "../../../lib/research/persist-evidence";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
/** Private, explicitly authorized read-only broker measurement; never place orders.
 * Broker generatedAt is retrieval time, NOT exchange event-time certification.
 * Unsupported sector/volatility/risk-policy inputs must never be synthesized.
 */
export async function POST(req:Request){
 if(!authorizeIngest(req))return NextResponse.json({error:"unauthorized"},{status:401,headers});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503,headers});
 const permission=brokerReadStatus();
 if(!permission.enabled||!permission.environment||!permission.credentials)
  return NextResponse.json({status:"blocked",reason:"authorized_broker_read_unavailable",saved:0},{status:503,headers});
 try{
  const snapshot=await alpacaBrokerState();
  if(!snapshot||snapshot.environment!==permission.environment||snapshot.accountStatus!=="ACTIVE")
   return NextResponse.json({status:"blocked",reason:"invalid_or_inactive_broker_account",saved:0},{status:422,headers});
  const asOf=Date.parse(snapshot.generatedAt),now=Date.now();
  if(!Number.isFinite(asOf)||asOf>now+5000||now-asOf>60000)
   return NextResponse.json({status:"blocked",reason:"stale_or_invalid_retrieval_timestamp",saved:0},{status:422,headers});
  if(snapshot.equity===null||!Number.isFinite(snapshot.equity)||snapshot.equity<=0||
   snapshot.positions.some(p=>!p.symbol||!Number.isFinite(p.marketValue)||!Number.isFinite(p.qty)||!["long","short"].includes(p.side)))
   return NextResponse.json({status:"blocked",reason:"invalid_equity_or_positions",saved:0},{status:422,headers});
  // Existing calculator requires sector and risk policy inputs; unavailable fields
  // are not replaced with guessed values or zero risk limits.
  const policy=[process.env.TRADEOS_MAX_GROSS_PCT,process.env.TRADEOS_MAX_SECTOR_PCT,
   process.env.TRADEOS_MAX_DAILY_LOSS,process.env.TRADEOS_DAILY_REALIZED_PNL].map(x=>x===undefined?NaN:Number(x));
  const hasPolicy=policy.every(Number.isFinite)&&policy[0]>0&&policy[1]>0&&policy[2]>0;
  const positions=snapshot.positions.map(p=>({symbol:p.symbol,sector:"UNVERIFIED",marketValue:Math.abs(p.marketValue)}));
  // Exposure and largest-name concentration need only authorized broker equity and
  // holdings. Sector concentration, volatility and remaining risk budget are blocked
  // until real sector/volatility and account-policy evidence exists.
  const result=portfolioRiskFactors({equity:snapshot.equity,positions,availableAt:snapshot.generatedAt},
   new Date(now).toISOString(),hasPolicy?policy[0]:100,hasPolicy?policy[1]:100,
   hasPolicy?policy[2]:1,hasPolicy?policy[3]:0);
  if(!result)return NextResponse.json({status:"blocked",reason:"calculation_rejected",saved:0},{status:422,headers});
  const eligible:PersistableEvidence[]=(["portfolio_exposure","single_name_weight"] as const).map(factor=>({
   factor,value:result[factor],domain:"stock",subject:"ALPACA_ACCOUNT_"+snapshot.environment,
   source:"Alpaca trading account:authorized read-only",observedAt:snapshot.generatedAt,
   availableAt:snapshot.generatedAt,metadata:{environment:snapshot.environment,
    input:"authorized account equity and current positions",positionCount:snapshot.positions.length,
    timestampKind:"broker_response_retrieval_not_exchange_event",
    backtestEligible:false,independentlyCertified:false,
    note:"Current account measurement only; no historical point-in-time inference."}
  }));
  const persisted=await persistEvidence(eligible);
  return NextResponse.json({status:"uncertified_current_account_measurement",...persisted,
   measuredFactors:eligible.map(x=>x.factor),blockedFactors:{
    sector_concentration:"verified_sector_mapping_required",
    position_volatility:"synchronized_historical_returns_and_covariance_required",
    risk_budget_remaining:hasPolicy?"authoritative_daily_realized_pnl_required":"risk_policy_and_realized_pnl_required"},
   certificationGranted:false,modelPromotionAllowed:false,ordersAllowed:false},{headers});
 }catch(e){return NextResponse.json({status:"provider_or_persistence_error",
  reason:e instanceof Error?e.message:"unknown",saved:0},{status:503,headers});}
}
