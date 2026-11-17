import {dailyCollectionPlan} from './daily-factor-collection';
import {evidenceTimestamp} from './evidence-time';
import {validateDailyHistory,completedDailyHistory} from './daily-history-validation';
import type {PriceBar} from "./market-factor-engine";
export type HistoryResult={bars:PriceBar[];source:string;error?:string};
/** Fetch completed DAILY Alpaca bars only. Never treat intraday bars as daily history. */
export async function alpacaDailyHistory(symbol:string,asOf:string,completedSession?:string):Promise<HistoryResult>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
 if(!key||!secret)return {bars:[],source:"Alpaca",error:"missing_credentials"};
 const feed=process.env.ALPACA_FEED||"iex";
 const cutoff=Date.parse(asOf);
 if(!Number.isFinite(cutoff))return {bars:[],source:"Alpaca",error:"invalid_as_of"};
 const nyDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(cutoff));
 if(completedSession!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(completedSession)||evidenceTimestamp(completedSession+'T00:00:00Z')===null||completedSession>nyDay))return {bars:[],source:'Alpaca',error:'invalid_completed_session'};
 if(completedSession!==undefined){
  try{if(dailyCollectionPlan(new Date(cutoff)).session!==completedSession)return {bars:[],source:'Alpaca',error:'invalid_completed_session'};}
  catch{return {bars:[],source:'Alpaca',error:'invalid_completed_session'};}
 }
 const end=new Date(cutoff).toISOString();
 const start=new Date(cutoff-800*86400000).toISOString();
 const url=new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars`);
 url.searchParams.set("timeframe","1Day");url.searchParams.set("start",start);url.searchParams.set("end",end);
 url.searchParams.set("limit","1000");url.searchParams.set("adjustment","raw");
 url.searchParams.set("feed",feed);
 try{
  const response=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {bars:[],source:"Alpaca",error:`http_${response.status}`};
  const data=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.bars)||
   (data.symbol!==undefined&&data.symbol!==symbol)||
   (data.next_page_token!==undefined&&data.next_page_token!==null&&typeof data.next_page_token!=='string'))return {bars:[],source:'Alpaca',error:'invalid_response'};
  if(completedSession!==undefined&&data.bars.length>1000)return {bars:[],source:'Alpaca',error:'oversized_history'};
  if(data.next_page_token)return {bars:[],source:'Alpaca',error:'pagination_incomplete'};
  const bars=data.bars.map((b:any)=>({timestamp:b?.t,open:b?.o,high:b?.h,low:b?.l,close:b?.c,volume:b?.v}));
  if(!validateDailyHistory(bars))return {bars:[],source:'Alpaca',error:'invalid_history'};
  if(completedSession!==undefined&&bars.some((b:PriceBar)=>Date.parse(b.timestamp)>=cutoff))return {bars:[],source:'Alpaca',error:'future_history'};
  return {bars:completedSession===undefined?completedDailyHistory(bars,cutoff):bars.filter((b:PriceBar)=>
   new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.timestamp))<=completedSession&&Date.parse(b.timestamp)<cutoff),source:'Alpaca:'+feed};
 }catch(e){return {bars:[],source:"Alpaca",error:"fetch_failed"};}
}
