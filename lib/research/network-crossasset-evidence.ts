import {historicalBars,type Bar} from "../market/features";
import type {PersistableEvidence} from "./persist-evidence";

async function massiveGoldPreviousClose(){
 const key=process.env.MASSIVE_API_KEY;
 if(!key)return {value:null as number|null,observedAt:null as string|null,error:"unconfigured"};
 const url=new URL("https://api.massive.com/v2/aggs/ticker/C:XAUUSD/prev");
 url.searchParams.set("adjusted","true");url.searchParams.set("apiKey",key);
 try{
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {value:null,observedAt:null,error:`http_${res.status}`};
  const payload=await res.json() as {results?:Array<{c?:number;t?:number;o?:number;h?:number;l?:number;v?:number}>};
  const row=payload.results?.[0],value=Number(row?.c),raw=Number(row?.t);
  const observed=Number.isFinite(raw)&&raw>0?new Date(raw>1e14?raw/1e6:raw>1e11?raw:raw*1000):null;
  if(!Number.isFinite(value)||value<=0||!observed||!Number.isFinite(observed.getTime()))return {value:null,observedAt:null,error:"invalid_payload"};
  return {value,observedAt:observed.toISOString(),error:null,metadata:{open:row?.o??null,high:row?.h??null,low:row?.l??null,volume:row?.v??null}};
 }catch(e){return {value:null,observedAt:null,error:e instanceof Error?e.message:"fetch_failed"};}
}

function ret(bars:Bar[],sessions:number){
 if(bars.length<sessions+1)return null;
 const a=bars[bars.length-sessions-1].c,z=bars[bars.length-1].c;
 return a>0?z/a-1:null;
}
function dailyReturns(bars:Bar[],count=20){
 const slice=bars.slice(-(count+1)),out=new Map<string,number>();
 for(let i=1;i<slice.length;i++){
  const a=slice[i-1].c,z=slice[i].c;
  if(a>0)out.set(slice[i].t.slice(0,10),z/a-1);
 }
 return out;
}
function correlation(a:Map<string,number>,b:Map<string,number>){
 const dates=[...a.keys()].filter(d=>b.has(d)).sort().slice(-20);
 if(dates.length<12)return null;
 const x=dates.map(d=>a.get(d)!),y=dates.map(d=>b.get(d)!);
 const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;
 let num=0,dx=0,dy=0;
 for(let i=0;i<x.length;i++){const xa=x[i]-mx,ya=y[i]-my;num+=xa*ya;dx+=xa*xa;dy+=ya*ya;}
 return dx>0&&dy>0?num/Math.sqrt(dx*dy):null;
}
const sectorMap:Record<string,string>={NVDA:"XLK",AMD:"XLK",PLTR:"XLK",AAPL:"XLK",MSFT:"XLK",META:"XLC",GOOGL:"XLC",AMZN:"XLY",TSLA:"XLY",JPM:"XLF",XOM:"XLE"};
const industryMap:Record<string,string>={NVDA:"SMH",AMD:"SMH",PLTR:"IGV",AAPL:"VGT",MSFT:"IGV",META:"XLC",GOOGL:"XLC",AMZN:"XLY",TSLA:"CARZ",JPM:"KBE",XOM:"XOP"};

export async function observedNetworkAndCrossAssetEvidence(now=new Date()){
 const feed=process.env.ALPACA_FEED||"iex";
 const availableAt=now.toISOString(),end=availableAt,start=new Date(now.getTime()-180*86400000).toISOString();
 const cache=new Map<string,Bar[]>();
 const get=async(symbol:string)=>{
  if(cache.has(symbol))return cache.get(symbol)!;
  const bars=await historicalBars(symbol,"1Day",start,260,feed,end);
  const complete=bars.filter(b=>Date.parse(b.t)<now.getTime()&&b.t.slice(0,10)<now.toISOString().slice(0,10));
  cache.set(symbol,complete);return complete;
 };
 const candidates:PersistableEvidence[]=[];
 const diagnostics:any[]=[];
 try{
  const gold=await massiveGoldPreviousClose();
  if(gold.value!==null&&gold.observedAt){
   candidates.push({factor:"gold",value:gold.value,source:"Massive Forex:C:XAUUSD previous-day aggregate",subject:"XAUUSD",observedAt:gold.observedAt,availableAt,domain:"stock",metadata:{...(gold.metadata??{}),unit:"USD_per_troy_ounce",market:"forex_XAUUSD",aggregation:"previous_trading_day"}});
  }else diagnostics.push({factor:"gold",error:gold.error});
 }catch(e){diagnostics.push({factor:"gold",error:e instanceof Error?e.message:"unknown"});}
 try{
  const [spy,tlt]=await Promise.all([get("SPY"),get("TLT")]);
  const tlt1=ret(tlt,1);
  if(tlt1!=null&&Number.isFinite(tlt1)&&tlt.length){
   candidates.push({factor:"treasury_etf_return",value:tlt1,source:`Alpaca:${feed}:1Day`,subject:"TLT",observedAt:tlt.at(-1)!.t,availableAt,domain:"stock",metadata:{sessions:1,proxy:"TLT",feed}});
  }
  const corr=correlation(dailyReturns(spy),dailyReturns(tlt));
  if(corr!=null&&Number.isFinite(corr)&&spy.length&&tlt.length){
   const observedAt=new Date(Math.min(Date.parse(spy.at(-1)!.t),Date.parse(tlt.at(-1)!.t))).toISOString();
   candidates.push({factor:"equity_bond_correlation",value:corr,source:`Alpaca:${feed}:1Day`,subject:"SPY_TLT",observedAt,availableAt,domain:"stock",metadata:{equity:"SPY",bond:"TLT",windowSessions:20,feed}});
  }
  diagnostics.push({pair:"SPY/TLT",spyBars:spy.length,tltBars:tlt.length});
 }catch(e){diagnostics.push({pair:"SPY/TLT",error:e instanceof Error?e.message:"unknown"});}

 try{
  const sectorEtfs=["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"];
  const rows=await Promise.all(sectorEtfs.map(async symbol=>({symbol,bars:await get(symbol)})));
  const latest=rows.flatMap(({symbol,bars})=>{
   const r=ret(bars,1),bar=bars.at(-1);
   return r!=null&&Number.isFinite(r)&&bar?[{symbol,value:r,date:bar.t.slice(0,10),observedAt:bar.t}]:[];
  });
  const counts=new Map<string,number>();for(const x of latest)counts.set(x.date,(counts.get(x.date)??0)+1);
  const commonDate=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0];
  const sameDay=commonDate?latest.filter(x=>x.date===commonDate):[];
  if(sameDay.length>=8){
   const breadth=sameDay.filter(x=>x.value>0).length/sameDay.length;
   const observedAt=sameDay.map(x=>x.observedAt).sort().at(-1)!;
   candidates.push({factor:"sector_breadth",value:breadth,source:`Alpaca:${feed}:1Day`,subject:"US_SECTOR_ETFS",observedAt,availableAt,domain:"stock",metadata:{method:"fraction_of_sector_etfs_with_positive_completed_session_return",sessionDate:commonDate,constituents:sameDay,unit:"fraction",feed}});
  }
  diagnostics.push({factor:"sector_breadth",eligible:latest.length,commonDate,commonCount:sameDay.length});
 }catch(e){diagnostics.push({factor:"sector_breadth",error:e instanceof Error?e.message:"unknown"});}

 for(const symbol of ["NVDA","AMD","PLTR"]){
  try{
   const sector=sectorMap[symbol],industry=industryMap[symbol];
   const names=[symbol,sector,industry].filter(Boolean);
   const rows=await Promise.all(names.map(get));
   const own=rows[0],ownRet=ret(own,20);
   if(ownRet==null||!Number.isFinite(ownRet)||!own.length)continue;
   if(sector){
    const sRet=ret(rows[1],20);
    if(sRet!=null&&Number.isFinite(sRet))candidates.push({factor:"sector_relative_return",value:ownRet-sRet,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:own.at(-1)!.t,availableAt,domain:"stock",metadata:{symbolReturn20:ownRet,sectorProxy:sector,sectorReturn20:sRet,windowSessions:20,feed}});
   }
   if(industry){
    const idx=sector===industry?1:2,sBars=rows[idx],iRet=ret(sBars,20);
    if(iRet!=null&&Number.isFinite(iRet))candidates.push({factor:"industry_relative_return",value:ownRet-iRet,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:own.at(-1)!.t,availableAt,domain:"stock",metadata:{symbolReturn20:ownRet,industryProxy:industry,industryReturn20:iRet,windowSessions:20,feed}});
   }
  }catch(e){diagnostics.push({symbol,error:e instanceof Error?e.message:"unknown"});}
 }
 return {retrievedAt:availableAt,candidates,diagnostics};
}
