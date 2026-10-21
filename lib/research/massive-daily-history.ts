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
  const j=await res.json() as {results?:Array<{t:number;o:number;h:number;l:number;c:number;v:number}>;next_url?:string};
  if(j.next_url)return {source:"Massive",bars:[],error:"pagination_incomplete"};
  const bars:PriceBar[]=(j.results??[]).filter(x=>Number.isFinite(x.t)&&x.t<cutoff&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)).map(x=>({timestamp:new Date(x.t).toISOString(),open:x.o,high:x.h,low:x.l,close:x.c,volume:x.v}));
  return {source:"Massive:historical_raw",bars};
 }catch(e){return {source:"Massive",bars:[],error:e instanceof Error?e.message:"unknown"};}
}
