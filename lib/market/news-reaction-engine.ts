import {evidenceTimestamp} from '../research/evidence-time';
export const NEWS_REACTION_METHOD='tradeos.news-reaction.completed-5min.v2';
const BAR=BigInt(300000000000),BEFORE=BigInt(600000000000),AFTER=BigInt(7200000000000);
type InputBar={barAt:string;start:bigint;end:bigint;close:number};
const unavailable=(reason:string)=>({status:'UNAVAILABLE' as const,reason,methodVersion:NEWS_REACTION_METHOD,scientificallyCertified:false as const});
const iso=(t:bigint)=>new Date(Number(t/BigInt(1000000))).toISOString();
export function calculateNewsReaction(bars:unknown,articleAt:string,asOf:string){
 const article=evidenceTimestamp(articleAt),cutoff=evidenceTimestamp(asOf);
 if(article===null||cutoff===null||article>cutoff)return unavailable('INVALID_CHRONOLOGY');
 if(!Array.isArray(bars)||bars.length>=1000)return unavailable('INVALID_OR_CAPPED_HISTORY');
 const ordered:InputBar[]=[],seen=new Set<string>();
 for(const row of bars){
  if(!row||typeof row!=='object'||Array.isArray(row))return unavailable('MALFORMED_HISTORY');
  const b=row as Record<string,unknown>,start=evidenceTimestamp(b.t);
  if(start===null||start % BAR!==BigInt(0))return unavailable('INVALID_BAR_TIMESTAMP');
  if(start>cutoff)return unavailable('BAR_AFTER_AS_OF');
  if(![b.o,b.h,b.l,b.c,b.v].every(v=>typeof v==='number'&&Number.isFinite(v)))return unavailable('INVALID_OHLCV');
  const [open,high,low,close,volume]=[b.o,b.h,b.l,b.c,b.v] as number[];
  if(low<=0||high<low||open<low||open>high||close<low||close>high||volume<0)return unavailable('INVALID_OHLCV');
  const key=String(start);if(seen.has(key))return unavailable('DUPLICATE_BAR_INSTANT');seen.add(key);
  ordered.push({barAt:b.t as string,start,end:start+BAR,close});
 }
 ordered.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
 const baseline=ordered.filter(b=>b.start>=article-BEFORE&&b.end<=article).at(-1);
 const endpoint=ordered.filter(b=>b.start>=article&&b.end<=article+AFTER&&b.end<=cutoff).at(-1);
 if(!baseline)return unavailable('NO_COMPLETED_PRE_NEWS_BAR');
 if(!endpoint)return unavailable('NO_COMPLETED_POST_NEWS_BAR');
 const rawReturnPct=(endpoint.close-baseline.close)/baseline.close*100;
 if(!Number.isFinite(rawReturnPct))return unavailable('NONFINITE_RETURN');
 return {status:'MEASURED' as const,methodVersion:NEWS_REACTION_METHOD,scientificallyCertified:false as const,
  returnPct:+rawReturnPct.toFixed(3),rawReturnPct,articleAt,asOf,inputCount:ordered.length,roundingDecimalPlaces:3,
  baseline:{barAt:baseline.barAt,closedAt:iso(baseline.end),close:baseline.close},
  endpoint:{barAt:endpoint.barAt,closedAt:iso(endpoint.end),close:endpoint.close}};
}
