import {curatedNews} from "../market/news";
import {latestNewsReaction} from "../market/newsReaction";
import type {PersistableEvidence} from "./persist-evidence";

const POS=/\b(beat|beats|raise[sd]?|upgrade[sd]?|record|strong|growth|win[ns]?|approval|approved|partnership|expand[sd]?|surge[sd]?|bullish|outperform|positive|accelerat(?:e|es|ed|ing))\b/i;
const NEG=/\b(miss|misses|cut[s]?|downgrade[sd]?|investigation|lawsuit|recall|weak|decline[sd]?|drop[s]?|delay[sed]?|bearish|underperform|warning|slump|fall[s]?|risk[s]?)\b/i;
const ANALYST_CHANGE=/\b(upgrade[sd]?|downgrade[sd]?|(?:raise[sd]?|lift(?:s|ed)?|hike[sd]?|boost(?:s|ed)?)\s+(?:the\s+|its\s+)?(?:price\s+)?target|(?:lower(?:s|ed)?|cut[s]?|slash(?:es|ed)?)\s+(?:the\s+|its\s+)?(?:price\s+)?target)\b/i;
const ANALYST_UP=/\b(upgrade[sd]?|raise[sd]?|lift(?:s|ed)?|hike[sd]?|boost(?:s|ed)?)\b/i;
const ANALYST_DOWN=/\b(downgrade[sd]?|lower(?:s|ed)?|cut[s]?|slash(?:es|ed)?)\b/i;
const STOP=new Set(["the","a","an","and","or","of","to","for","in","on","with","at","by","from","as","is","are","be","this","that"]);
function sentiment(text:string){let s=0;if(POS.test(text))s++;if(NEG.test(text))s--;return s;}
function tokens(text:string){return new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)))}
function jaccard(a:Set<string>,b:Set<string>){const union=new Set([...a,...b]);if(!union.size)return 0;let hit=0;for(const x of a)if(b.has(x))hit++;return hit/union.size;}
function maxCorroboration(items:Array<{headline:string;source:string}>){
 let max=1;
 for(let i=0;i<items.length;i++){
  const base=tokens(items[i].headline),sources=new Set([items[i].source]);
  for(let j=0;j<items.length;j++)if(i!==j&&jaccard(base,tokens(items[j].headline))>=.55)sources.add(items[j].source);
  max=Math.max(max,sources.size);
 }
 return max;
}

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
  const weights=related.map(n=>Math.max(.1,Number(n.sourceQuality??.5))*Math.max(.1,Number((n as any).recency??.5)));
  const denom=weights.reduce((a,b)=>a+b,0);
  const net=denom?related.reduce((sum,n,i)=>sum+sentiment(n.headline+" "+(n.summary??""))*weights[i],0)/denom:0;
  const analystItems=related.filter(n=>n.symbols.length===1&&n.symbols[0]===symbol&&ANALYST_CHANGE.test(n.headline+" "+(n.summary??"")));
  if(analystItems.length){
   const directional:number[]=analystItems.map(n=>{const text=n.headline+" "+(n.summary??"");return ANALYST_DOWN.test(text)?-1:ANALYST_UP.test(text)?1:0;});
   const weights=analystItems.map(n=>Math.max(.1,Number(n.sourceQuality??.5))*Math.max(.1,Number((n as any).recency??.5)));
   const denom=weights.reduce((a,b)=>a+b,0);
   const value=denom?directional.reduce<number>((sum,d,i)=>sum+d*weights[i],0)/denom:0;
   const observedAt=analystItems.map(n=>n.timestamp).sort().at(-1)!;
   candidates.push({factor:"analyst_revision",value,source:"CuratedNews:"+[...new Set(analystItems.map(n=>n.source))].sort().join(","),subject:symbol,observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"explicit single-symbol analyst upgrade/downgrade or price-target change headlines",articleIds:analystItems.map(n=>n.id),directions:directional,unit:"signed_direction_-1_to_1",note:"Headline-derived analyst action, not consensus-estimate revision."}});
  }
  const corroboration=maxCorroboration(related);
  candidates.push(
   {factor:"headline_count",value:related.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata},
   {factor:"news_source_diversity",value:sources.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata},
   {factor:"headline_novelty",value:ids.size/related.length,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata},
   {factor:"news_sentiment",value:net,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata:{...metadata,method:"weighted lexical polarity",unit:"signed_score_-1_to_1"}},
   {factor:"corroboration",value:corroboration,source,subject:symbol,observedAt:retrievedAt,availableAt:retrievedAt,domain:"news",metadata:{...metadata,method:"maximum distinct source labels among headline clusters with token Jaccard >= 0.55"}}
  );
 }
 for(const symbol of clean.filter(s=>!["QQQ","IWM"].includes(s)).slice(0,3)){
  try{
   const reaction=await latestNewsReaction(symbol);
   if(reaction?.matched&&reaction.timestamp&&reaction.returnPct!=null&&Number.isFinite(reaction.returnPct)){
    const reactionMetadata={headline:reaction.headline,classification:reaction.classification,reactionScore:reaction.reactionScore,unit:"percent_return",method:"news timestamp to latest eligible bar within 120 minutes"};
    candidates.push(
     {factor:"news_price_reaction",value:reaction.returnPct,source:"CuratedNews + Alpaca 5Min bars",subject:symbol,observedAt:reaction.timestamp,availableAt:retrievedAt,domain:"news",metadata:reactionMetadata},
     {factor:"event_materiality",value:Math.abs(reaction.returnPct),source:"CuratedNews + Alpaca 5Min bars",subject:symbol,observedAt:reaction.timestamp,availableAt:retrievedAt,domain:"news",metadata:{...reactionMetadata,unit:"absolute_percent_return",method:"absolute measured post-news price reaction; descriptive materiality only"}}
    );
   }
  }catch{}
 }
 return {retrievedAt,symbols:clean,newsCount:result.news.length,errors:result.errors,candidates};
}
