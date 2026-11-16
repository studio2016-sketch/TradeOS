import {evidenceTimestamp} from "./evidence-time";
import {db} from "../db";
import {historicalBars} from "../market/features";
import {secFundamentalsAsOf} from "../market/sec";
import type {PersistableEvidence} from "./persist-evidence";
import {halfSpreadSlippageBps,returnAtMinutes,sessionTradeCount,turnoverFromVolumeShares} from "./intraday-factor-engine";

function nyDay(ts:string|number|Date){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ts));
}
function finite(v:unknown):v is number{return typeof v==="number"&&Number.isFinite(v)}

export const INTRADAY_AVAILABILITY_VERSION="tradeos.intraday-availability.v1";
type QuoteRow={source_id:unknown;event_time:unknown;metadata:unknown};
type IntradayDependencies={
 history:typeof historicalBars;
 fundamentals:typeof secFundamentalsAsOf;
 quote:()=>Promise<QuoteRow[]>;
 clock:()=>Date;
};

export async function observedIntradayActivationEvidence(now=new Date()){
 return observedIntradayActivationEvidenceWithDependencies({
  history:historicalBars,fundamentals:secFundamentalsAsOf,clock:()=>new Date(),
  quote:async()=>{
   const sql=db();
   const rows=await sql`select source_id,event_time,metadata from source_observations
    where symbol='SPY' and data_class='market_snapshot'
      and (metadata->>'bid') is not null and (metadata->>'ask') is not null
    order by received_at desc limit 1`;
   return rows.map(row=>({source_id:row.source_id,event_time:row.event_time,metadata:row.metadata}));
  }
 },now);
}

/** Receipt time is sampled after asynchronous inputs and extraction, never backdated to the request. */
export async function observedIntradayActivationEvidenceWithDependencies(deps:IntradayDependencies,now=new Date()){
 let lastReceipt=now.getTime();
 if(!Number.isFinite(lastReceipt))throw Error("Invalid intraday request clock");
 function receiptTime(){
  const received=deps.clock().getTime();
  if(!Number.isFinite(received))throw Error("Invalid intraday completion clock");
  if(received<lastReceipt)throw Error("Intraday completion clock moved backwards");
  lastReceipt=received;
  return new Date(received).toISOString();
 }
 const feed=process.env.ALPACA_FEED||"iex";
 const end=new Date(now.getTime()-2*60000).toISOString();
 const start=new Date(now.getTime()-7*86400000).toISOString();
 const requestedAt=now.toISOString();
 const candidates:Omit<PersistableEvidence,"availableAt">[]=[];
 const diagnostics:any[]=[];
 for(const symbol of ["SPY","NVDA"]){
  try{
   const bars=await deps.history(symbol,"1Min",start,1000,feed,end);
   const today=nyDay(now),days=[...new Set(bars.map(b=>nyDay(b.t)))];
   const current=bars.filter(b=>nyDay(b.t)===today);
   const currentFresh=current.length>1&&now.getTime()-Date.parse(current[current.length-1].t)<=15*60000;
   const chosenDay=currentFresh?today:[...days].filter(d=>d<today).at(-1);
   const session=chosenDay?bars.filter(b=>nyDay(b.t)===chosenDay):[];
   const source=`Alpaca:${feed}:1Min`;
   for(const [factor,minutes] of [["return_1m",1],["return_5m",5],["return_15m",15],["return_1h",60]] as const){
    const measured=returnAtMinutes(session,minutes);
    if(measured)candidates.push({factor,value:measured.value,source,subject:symbol,observedAt:measured.observedAt,domain:"stock",metadata:{timeframe:"1Min",minutes,priorAt:measured.priorAt,sessionDay:chosenDay,feed,currentFresh}});
   }
   const tradeBars=session.filter(b=>finite(b.n)),count=sessionTradeCount(session);
   if(count!==null)candidates.push({factor:"trade_count",value:count,source,subject:symbol,observedAt:session.at(-1)!.t,domain:"stock",metadata:{sessionDay:chosenDay,bars:session.length,barsWithTradeCount:tradeBars.length,feed}});
   diagnostics.push({symbol,bars:bars.length,sessionDay:chosenDay,sessionBars:session.length,currentFresh});
  }catch(e){diagnostics.push({symbol,error:e instanceof Error?e.message:"unknown"});}
  receiptTime();
 }

 try{
  const symbol="NVDA";
  const filing=await deps.fundamentals(symbol,requestedAt);
  const daily=await deps.history(symbol,"1Day",new Date(now.getTime()-45*86400000).toISOString(),100,feed,end);
  const completed=daily.filter(b=>nyDay(b.t)<nyDay(now));
  const last=completed.at(-1),shares=filing.values.shares;
  const turnover=last&&finite(last.v)&&finite(shares)?turnoverFromVolumeShares(last.v,shares):null;
  if(last&&turnover!==null)candidates.push({factor:"turnover",value:turnover,source:`Alpaca:${feed}:1Day + SEC EDGAR XBRL`,subject:symbol,observedAt:last.t,domain:"stock",metadata:{volume:last.v,shares,sharesProvenance:filing.provenance.shares,unit:"fraction_of_shares_outstanding"}});
 }catch(e){diagnostics.push({symbol:"NVDA",turnoverError:e instanceof Error?e.message:"unknown"});}
 receiptTime();

 try{
  const rows=await deps.quote();
  const row=rows[0],m=row?.metadata as any;
  const bid=m?.bid,ask=m?.ask;
  const value=finite(bid)&&finite(ask)?halfSpreadSlippageBps(bid,ask):null;
  const quoteTime=m?.quoteTimestamp;
  if(row&&value!==null&&typeof quoteTime==="string"&&evidenceTimestamp(quoteTime)!==null){
   candidates.push({factor:"slippage_estimate",value,source:String(row.source_id),subject:"SPY",observedAt:quoteTime,domain:"stock",metadata:{method:"half_quoted_spread_bps_within_top_of_book_depth",bid,ask,bidSize:m?.bidSize??null,askSize:m?.askSize??null,unit:"bps"}});
  }else if(row){
   diagnostics.push({symbol:"SPY",slippageError:value===null?"invalid_quote_prices":"missing_or_invalid_quote_timestamp"});
  }
 }catch(e){diagnostics.push({symbol:"SPY",slippageError:e instanceof Error?e.message:"unknown"});}

 const retrievedAt=receiptTime();
 return {requestedAt,retrievedAt,candidates:candidates.map(candidate=>({...candidate,availableAt:retrievedAt,
  metadata:{...candidate.metadata,requestedAt,availabilityKind:"extraction_completed",availabilityVersion:INTRADAY_AVAILABILITY_VERSION}
 })),diagnostics};
}
