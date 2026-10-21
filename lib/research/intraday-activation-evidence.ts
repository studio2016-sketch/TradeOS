import {db} from "../db";
import {historicalBars,type Bar} from "../market/features";
import {secFundamentalsAsOf} from "../market/sec";
import type {PersistableEvidence} from "./persist-evidence";

function nyDay(ts:string|number|Date){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ts));
}
function finite(v:unknown):v is number{return typeof v==="number"&&Number.isFinite(v)}
function returnAtMinutes(bars:Bar[],minutes:number){
 if(bars.length<2)return null;
 const last=bars[bars.length-1],lastTime=Date.parse(last.t),target=lastTime-minutes*60000;
 let prior:Bar|null=null;
 for(const bar of bars){const t=Date.parse(bar.t);if(t<=target)prior=bar;else break;}
 if(!prior||prior.c<=0)return null;
 const gap=Math.abs(Date.parse(prior.t)-target);
 const tolerance=minutes<=1?90000:minutes<=15?3*60000:6*60000;
 if(gap>tolerance)return null;
 return {value:last.c/prior.c-1,observedAt:last.t,priorAt:prior.t};
}

export async function observedIntradayActivationEvidence(now=new Date()){
 const feed=process.env.ALPACA_FEED||"iex";
 const end=new Date(now.getTime()-2*60000).toISOString();
 const start=new Date(now.getTime()-7*86400000).toISOString();
 const availableAt=now.toISOString();
 const candidates:PersistableEvidence[]=[];
 const diagnostics:any[]=[];
 for(const symbol of ["SPY","NVDA"]){
  try{
   const bars=await historicalBars(symbol,"1Min",start,1000,feed,end);
   const today=nyDay(now),days=[...new Set(bars.map(b=>nyDay(b.t)))];
   const current=bars.filter(b=>nyDay(b.t)===today);
   const currentFresh=current.length>1&&now.getTime()-Date.parse(current[current.length-1].t)<=15*60000;
   const chosenDay=currentFresh?today:[...days].filter(d=>d<today).at(-1);
   const session=chosenDay?bars.filter(b=>nyDay(b.t)===chosenDay):[];
   const source=`Alpaca:${feed}:1Min`;
   for(const [factor,minutes] of [["return_1m",1],["return_5m",5],["return_15m",15],["return_1h",60]] as const){
    const measured=returnAtMinutes(session,minutes);
    if(measured)candidates.push({factor,value:measured.value,source,subject:symbol,observedAt:measured.observedAt,availableAt,domain:"stock",metadata:{timeframe:"1Min",minutes,priorAt:measured.priorAt,sessionDay:chosenDay,feed,currentFresh}});
   }
   const tradeBars=session.filter(b=>finite(b.n));
   if(session.length&&tradeBars.length/session.length>=.9){
    const count=tradeBars.reduce((n,b)=>n+Number(b.n),0);
    if(Number.isFinite(count)&&count>=0)candidates.push({factor:"trade_count",value:count,source,subject:symbol,observedAt:session.at(-1)!.t,availableAt,domain:"stock",metadata:{sessionDay:chosenDay,bars:session.length,barsWithTradeCount:tradeBars.length,feed}});
   }
   diagnostics.push({symbol,bars:bars.length,sessionDay:chosenDay,sessionBars:session.length,currentFresh});
  }catch(e){diagnostics.push({symbol,error:e instanceof Error?e.message:"unknown"});}
 }

 try{
  const symbol="NVDA";
  const filing=await secFundamentalsAsOf(symbol,availableAt);
  const daily=await historicalBars(symbol,"1Day",new Date(now.getTime()-45*86400000).toISOString(),100,feed,end);
  const completed=daily.filter(b=>nyDay(b.t)<nyDay(now));
  const last=completed.at(-1),shares=filing.values.shares;
  if(last&&finite(last.v)&&last.v>=0&&finite(shares)&&shares>0){
   candidates.push({factor:"turnover",value:last.v/shares,source:`Alpaca:${feed}:1Day + SEC EDGAR XBRL`,subject:symbol,observedAt:last.t,availableAt,domain:"stock",metadata:{volume:last.v,shares,sharesProvenance:filing.provenance.shares,unit:"fraction_of_shares_outstanding"}});
  }
 }catch(e){diagnostics.push({symbol:"NVDA",turnoverError:e instanceof Error?e.message:"unknown"});}

 try{
  const sql=db();
  const rows=await sql`select source_id,event_time,metadata from source_observations
    where symbol='SPY' and data_class='market_snapshot'
      and (metadata->>'bid') is not null and (metadata->>'ask') is not null
    order by received_at desc limit 1`;
  const row=rows[0],m=row?.metadata as any;
  const bid=Number(m?.bid),ask=Number(m?.ask),mid=(bid+ask)/2;
  if(row&&bid>0&&ask>=bid&&mid>0){
   const value=((ask-bid)/2)/mid*10000;
   const quoteTime=Number.isFinite(Date.parse(String(m?.quoteTimestamp??"")))?String(m.quoteTimestamp):new Date(row.event_time as string).toISOString();
   candidates.push({factor:"slippage_estimate",value,source:String(row.source_id),subject:"SPY",observedAt:quoteTime,availableAt,domain:"stock",metadata:{method:"half_quoted_spread_bps_within_top_of_book_depth",bid,ask,bidSize:m?.bidSize??null,askSize:m?.askSize??null,unit:"bps"}});
  }
 }catch(e){diagnostics.push({symbol:"SPY",slippageError:e instanceof Error?e.message:"unknown"});}

 return {retrievedAt:availableAt,candidates,diagnostics};
}
