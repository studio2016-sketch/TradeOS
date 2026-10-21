import {curatedNews} from "../market/news";
import {latestNewsReaction} from "../market/newsReaction";
import type {PersistableEvidence} from "./persist-evidence";

const POS=/\b(beat|beats|raise[sd]?|upgrade[sd]?|record|strong|growth|win[ns]?|approval|approved|partnership|expand[sd]?|surge[sd]?|bullish|outperform|positive|accelerat(?:e|es|ed|ing))\b/i;
const NEG=/\b(miss|misses|cut[s]?|downgrade[sd]?|investigation|lawsuit|recall|weak|decline[sd]?|drop[s]?|delay[sed]?|bearish|underperform|warning|slump|fall[s]?|risk[s]?)\b/i;
const ANALYST_CHANGE=/\b(upgrade[sd]?|downgrade[sd]?|(?:raise[sd]?|lift(?:s|ed)?|hike[sd]?|boost(?:s|ed)?)\s+(?:the\s+|its\s+)?(?:price\s+)?target|(?:lower(?:s|ed)?|cut[s]?|slash(?:es|ed)?)\s+(?:the\s+|its\s+)?(?:price\s+)?target)\b/i;
const ANALYST_UP=/\b(upgrade[sd]?|raise[sd]?|lift(?:s|ed)?|hike[sd]?|boost(?:s|ed)?)\b/i;
const ANALYST_DOWN=/\b(downgrade[sd]?|lower(?:s|ed)?|cut[s]?|slash(?:es|ed)?)\b/i;
const GEO_RISK=/\b(war|armed conflict|military strike|missile|invasion|sanction(?:s|ed)?|blockade|strait of hormuz|geopolit(?:ic|ical)|ceasefire|hostilit(?:y|ies))\b/i;
const POLICY_ACTOR=/\b(federal reserve|fed\b|white house|u\.s\. treasury|treasury department|department of energy|department of commerce|sec\b|ftc\b|doj\b|congress|president|administration)\b/i;
const POLICY_ACTION=/\b(announc(?:e|es|ed|ement)|approv(?:e|es|ed|al)|invest(?:s|ed|ing)|rule|regulat(?:ion|ory)|tariff|sanction|executive order|rate decision|policy change|ban|restriction)\b/i;
const GUIDANCE_CHANGE=/\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?|lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?|reaffirm(?:s|ed)?)\b.{0,45}\b(guidance|outlook|forecast)\b|\b(guidance|outlook|forecast)\b.{0,45}\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?|lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?|reaffirm(?:s|ed)?)\b/i;
const GUIDANCE_UP=/\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?)\b/i;
const GUIDANCE_DOWN=/\b(lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?)\b/i;
const BUYBACK=/\b(announc(?:e|es|ed)|authoriz(?:e|es|ed)|expand(?:s|ed)?|increase[sd]?)\b.{0,55}\b(buyback|share repurchase|stock repurchase)\b|\b(buyback|share repurchase|stock repurchase)\b.{0,55}\b(announc(?:e|es|ed)|authoriz(?:e|es|ed)|expand(?:s|ed)?|increase[sd]?)\b/i;
const TARIFF=/\b(tariff(?:s)?|import dut(?:y|ies)|trade restriction(?:s)?|export restriction(?:s)?|export control(?:s)?)\b/i;
const REGULATOR=/\b(sec|ftc|doj|fda|epa|fcc|department of justice|securities and exchange commission|federal trade commission)\b/i;
const REGULATORY_ACTION=/\b(rule|regulat(?:ion|ory)|approv(?:e|es|ed|al)|reject(?:s|ed|ion)?|block(?:s|ed)?|sue[sd]?|lawsuit|settle(?:s|d|ment)?|investigat(?:e|es|ed|ion)|ban(?:s|ned)?|order)\b/i;
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
  const explicitGuidance=related.filter(n=>GUIDANCE_CHANGE.test(n.headline+" "+(n.summary??"")));
  if(explicitGuidance.length){
   const scores=explicitGuidance.map(n=>{const text=n.headline+" "+(n.summary??"");return GUIDANCE_DOWN.test(text)?-1:GUIDANCE_UP.test(text)?1:0;});
   const observedAt=explicitGuidance.map(n=>n.timestamp).sort().at(-1)!;
   candidates.push({factor:"guidance_change",value:scores.reduce((a,b)=>a+b,0)/scores.length,source:"CuratedNews:"+[...new Set(explicitGuidance.map(n=>n.source))].sort().join(","),subject:symbol,observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"explicit_guidance_or_outlook_change_headlines",articleIds:explicitGuidance.map(n=>n.id),directions:scores,unit:"average_direction_-1_to_1"}});
  }
  const buybacks=related.filter(n=>BUYBACK.test(n.headline+" "+(n.summary??"")));
  if(buybacks.length){
   const observedAt=buybacks.map(n=>n.timestamp).sort().at(-1)!;
   candidates.push({factor:"buyback_announcement",value:buybacks.length,source:"CuratedNews:"+[...new Set(buybacks.map(n=>n.source))].sort().join(","),subject:symbol,observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"count_of_explicit_buyback_or_repurchase_announcement_headlines",articleIds:buybacks.map(n=>n.id),unit:"event_count"}});
  }
  const tariffItems=related.filter(n=>TARIFF.test(n.headline+" "+(n.summary??"")));
  if(tariffItems.length){
   const observedAt=tariffItems.map(n=>n.timestamp).sort().at(-1)!;
   candidates.push({factor:"tariff_exposure",value:tariffItems.length/related.length,source:"CuratedNews:"+[...new Set(tariffItems.map(n=>n.source))].sort().join(","),subject:symbol,observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"share_of_symbol_news_explicitly_referencing_tariffs_or_trade_restrictions",articleIds:tariffItems.map(n=>n.id),unit:"fraction"}});
  }
  const regulatory=related.filter(n=>{const text=n.headline+" "+(n.summary??"");return REGULATOR.test(text)&&REGULATORY_ACTION.test(text);});
  if(regulatory.length){
   const observedAt=regulatory.map(n=>n.timestamp).sort().at(-1)!;
   candidates.push({factor:"regulatory_change",value:regulatory.length,source:"CuratedNews:"+[...new Set(regulatory.map(n=>n.source))].sort().join(","),subject:symbol,observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"count_of_explicit_regulator_action_headlines",articleIds:regulatory.map(n=>n.id),unit:"event_count",note:"Secondary-source observation; primary regulatory document verification remains a certification gate."}});
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
 const recentMarket=result.news.filter(n=>Number.isFinite(Date.parse(n.timestamp))&&Date.parse(n.timestamp)>=start&&Date.parse(n.timestamp)<=now.getTime());
 const geo=recentMarket.filter(n=>GEO_RISK.test(n.headline+" "+(n.summary??"")));
 if(geo.length&&recentMarket.length){
  const sources=[...new Set(geo.map(n=>n.source))].sort();
  const observedAt=geo.map(n=>n.timestamp).sort().at(-1)!;
  candidates.push({factor:"geopolitical_risk",value:geo.length/recentMarket.length,source:"CuratedNews:"+sources.join(","),subject:"US_MARKET",observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"explicit_geopolitical_headline_share_of_recent_market_news",windowHours:24,matchedArticles:geo.length,totalArticles:recentMarket.length,articleIds:geo.map(n=>n.id),unit:"fraction",note:"Descriptive news-intensity proxy, not the Caldara-Iacoviello GPR index."}});
 }
 const policy=recentMarket.filter(n=>POLICY_ACTOR.test(n.headline+" "+(n.summary??""))&&POLICY_ACTION.test(n.headline+" "+(n.summary??"")));
 if(policy.length){
  const sources=[...new Set(policy.map(n=>n.source))].sort();
  const observedAt=policy.map(n=>n.timestamp).sort().at(-1)!;
  candidates.push({factor:"policy_announcement",value:policy.length,source:"CuratedNews:"+sources.join(","),subject:"US_POLICY",observedAt,availableAt:retrievedAt,domain:"news",metadata:{method:"count_of_explicit_government_or_central_bank_policy_action_headlines",windowHours:24,articleIds:policy.map(n=>n.id),unit:"article_count",note:"Secondary-source observation of explicit policy actions; primary-source verification remains a certification gate."}});
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
