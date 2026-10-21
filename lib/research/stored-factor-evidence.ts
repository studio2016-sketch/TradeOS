import {FACTOR_KEYS} from "./acceleration-factors";
import type {Evidence} from "./source-vintage-audit";

type StoredRow={symbol:string;market_time:string;recorded_at:string;provider:string;features:Record<string,number|null>;news?:any};
const direct=new Set(["daily_volume","distance_vwap","bid_ask_spread","spread_bps","quoted_depth","order_imbalance"]);
const newsKeys=new Set(["headline_count","headline_novelty","news_source_diversity"]);
const fundamentalKeys=new Set(["market_cap","net_margin"]);

/** Recover only values whose stored provenance identifies how they were measured. */
export function storedFactorEvidence(rows:StoredRow[]):Evidence[]{
 const evidence:Evidence[]=[];
 for(const row of rows){
  const marketTime=Date.parse(row.market_time),recordedAt=Date.parse(row.recorded_at);
  if(!row.symbol||!row.provider||!Number.isFinite(marketTime)||!Number.isFinite(recordedAt)||marketTime>recordedAt)continue;
  const provenance=row.news&&typeof row.news==="object"?row.news:{};
  for(const [factor,value] of Object.entries(row.features??{})){
   if(!(FACTOR_KEYS as readonly string[]).includes(factor)||typeof value!=="number"||!Number.isFinite(value))continue;
   let source:string|null=null,observedAt=row.market_time,domain:Evidence["domain"]="stock";
   if(direct.has(factor))source=row.provider;
   const derived=provenance.derivedFactors?.[factor];
   if(!source&&derived&&Number.isFinite(derived.value)&&Number(derived.value)===value&&Number(provenance.history?.barCount)>0){
    source=String(provenance.history?.source||row.provider)+":derived";
    if(Number.isFinite(Date.parse(String(derived.asOf??""))))observedAt=String(derived.asOf);
   }
   if(!source&&fundamentalKeys.has(factor)&&provenance.fundamentals?.status==="ok"){
    source="SEC Companyfacts";
    const dates=Object.values(provenance.fundamentals?.provenance??{}).map((x:any)=>String(x?.filed??"")).filter(Boolean).sort();
    if(dates.length)observedAt=dates.at(-1)+"T23:59:59Z";
   }
   if(!source&&factor==="sec_filing_catalyst"&&provenance.sec?.status==="ok")source="SEC EDGAR";
   if(!source&&newsKeys.has(factor)){
    const articles=Array.isArray(provenance.news)?provenance.news:[];
    if(articles.length){source=[...new Set(articles.map((x:any)=>String(x.source||"")).filter(Boolean))].join(" + ")||"Provider News";domain="news";
     const dates=articles.map((x:any)=>String(x.timestamp??"")).filter((x:string)=>Number.isFinite(Date.parse(x))).sort();if(dates.length)observedAt=dates.at(-1)!;
    }else if(Array.isArray(provenance.errors)&&provenance.errors.length===0){source="Provider News:verified empty result";domain="news";}
   }
   if(!source)continue;
   evidence.push({factor,value,domain,source,subject:row.symbol,observedAt,availableAt:row.recorded_at});
  }
 }
 return evidence;
}
