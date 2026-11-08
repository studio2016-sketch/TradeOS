import {validateDailyHistory,completedDailyHistory} from './daily-history-validation';
import type {PriceBar} from "./market-factor-engine";
import type {HistoryResult} from "./market-factor-history";
export async function massiveDailyHistory(symbol:string,asOf:string):Promise<HistoryResult>{
 const key=process.env.MASSIVE_API_KEY,cutoff=Date.parse(asOf);
 if(!key)return {source:"Massive",bars:[],error:"missing_credentials"};
 if(!Number.isFinite(cutoff))return {source:"Massive",bars:[],error:"invalid_as_of"};
 const end=new Date(cutoff-86400000).toISOString().slice(0,10);
 const start=new Date(cutoff-800*86400000).toISOString().slice(0,10);
 const url=new URL("https://api.massive.com/v2/aggs/ticker/"+encodeURIComponent(symbol)+"/range/1/day/"+start+"/"+end);
 url.searchParams.set("apiKey",key);url.searchParams.set("adjusted","false");url.searchParams.set("sort","asc");url.searchParams.set("limit","50000");
 try{
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {source:"Massive",bars:[],error:"http_"+res.status};
  const j=await res.json();
  if(!j||typeof j!=='object'||Array.isArray(j)||!Array.isArray(j.results)||
   (j.ticker!==undefined&&j.ticker!==symbol)||
   (j.next_url!==undefined&&j.next_url!==null&&typeof j.next_url!=='string'))return {source:'Massive',bars:[],error:'invalid_response'};
  if(j.next_url)return {source:'Massive',bars:[],error:'pagination_incomplete'};
  // Validate timestamp types before conversion; Date must never normalize or hide a bad row.
  if(j.results.some((b:any)=>!b||!Number.isSafeInteger(b.t)||Math.abs(b.t)>8640000000000000))return {source:'Massive',bars:[],error:'invalid_history'};
  const bars:PriceBar[]=j.results.map((b:any)=>({timestamp:new Date(b.t).toISOString(),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v}));
  if(!validateDailyHistory(bars))return {source:'Massive',bars:[],error:'invalid_history'};
  return {source:'Massive:historical_raw',bars:completedDailyHistory(bars,cutoff)};
 }catch(e){return {source:"Massive",bars:[],error:"fetch_failed"};}
}
