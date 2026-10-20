import type {PriceBar} from "./market-factor-engine";
export type HistoryResult={bars:PriceBar[];source:string;error?:string};
/** Fetch completed DAILY Alpaca bars only. Never treat intraday bars as daily history. */
export async function alpacaDailyHistory(symbol:string,asOf:string):Promise<HistoryResult>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
 if(!key||!secret)return {bars:[],source:"Alpaca",error:"missing_credentials"};
 const cutoff=Date.parse(asOf);
 if(!Number.isFinite(cutoff))return {bars:[],source:"Alpaca",error:"invalid_as_of"};
 // Only completed US exchange sessions: exclude current New York trading date.
 const nyDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(cutoff));
 const end=new Date(cutoff).toISOString();
 const start=new Date(cutoff-400*86400000).toISOString();
 const url=new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars`);
 url.searchParams.set("timeframe","1Day");url.searchParams.set("start",start);url.searchParams.set("end",end);
 url.searchParams.set("limit","400");url.searchParams.set("adjustment","raw");
 url.searchParams.set("feed",process.env.ALPACA_FEED||"iex");
 try{
  const response=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {bars:[],source:"Alpaca",error:`http_${response.status}`};
  const data=await response.json() as {bars?:Array<{t:string;o:number;h:number;l:number;c:number;v:number}>;next_page_token?:string};
  if(data.next_page_token)return {bars:[],source:"Alpaca",error:"pagination_incomplete"};
  // Current-day bars are incomplete. Only use bars from earlier UTC calendar dates.
  const day=nyDay;
  const bars=(data.bars??[]).filter(b=>b.t.slice(0,10)<day&&Date.parse(b.t)<cutoff).map(b=>({timestamp:b.t,open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v}));
  return {bars,source:"Alpaca:"+ (process.env.ALPACA_FEED||"iex")};
 }catch(e){return {bars:[],source:"Alpaca",error:e instanceof Error?e.message:"fetch_failed"};}
}
