import {curatedNews} from "../market/news";
import type {PersistableEvidence} from "./persist-evidence";

export async function observedNewsFactors(symbols:string[],now=new Date()){
 const clean=[...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
 const retrievedAt=now.toISOString();
 const result=await curatedNews(clean,80);
 const start=now.getTime()-24*60*60*1000;
 const candidates:PersistableEvidence[]=[];
 for(const symbol of clean){
  const related=result.news.filter(n=>n.symbols.includes(symbol)&&Number.isFinite(Date.parse(n.timestamp))&&Date.parse(n.timestamp)>=start&&Date.parse(n.timestamp)<=now.getTime());
  if(!related.length)continue;
  const sources=[...new Set(related.map(n=>n.source).filter(Boolean))].sort();
  const ids=new Set(related.map(n=>n.id));
  const source="CuratedNews:"+sources.join(",");
  const metadata={windowHours:24,articleCount:related.length,articleIds:[...ids],sources,providerErrors:result.errors};
  candidates.push(
   {factor:"headline_count",value:related.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata},
   {factor:"news_source_diversity",value:sources.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata},
   {factor:"headline_novelty",value:ids.size/related.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata}
  );
 }
 return {retrievedAt,symbols:clean,newsCount:result.news.length,errors:result.errors,candidates};
}
