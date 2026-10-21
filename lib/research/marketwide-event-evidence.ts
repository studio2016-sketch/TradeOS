import {db} from "../db";
import type {PersistableEvidence} from "./persist-evidence";

type CachedArticle={article_id:string;published_at:string;headline:string;summary:string;symbols:string[];source_name:string};

const GUIDANCE=/\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?|lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?|reaffirm(?:s|ed)?|maintain(?:s|ed)?)\b.{0,55}\b(guidance|outlook|forecast)\b|\b(guidance|outlook|forecast)\b.{0,55}\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?|lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?|reaffirm(?:s|ed)?|maintain(?:s|ed)?)\b/i;
const GUIDANCE_UP=/\b(raise[sd]?|boost(?:s|ed)?|increase[sd]?)\b/i;
const GUIDANCE_DOWN=/\b(lower(?:s|ed)?|cut[s]?|reduce[sd]?|withdraw(?:s|n)?|suspend(?:s|ed)?)\b/i;
const REGULATOR=/\b(sec|ftc|doj|fda|epa|fcc|department of justice|securities and exchange commission|federal trade commission|food and drug administration)\b/i;
const REG_ACTION=/\b(rule|regulat(?:ion|ory)|approv(?:e|es|ed|al)|reject(?:s|ed|ion)?|block(?:s|ed)?|sue[sd]?|lawsuit|settle(?:s|d|ment)?|investigat(?:e|es|ed|ion)|ban(?:s|ned)?|order)\b/i;
const TARIFF=/\b(tariff(?:s)?|import dut(?:y|ies)|trade restriction(?:s)?|export restriction(?:s)?|export control(?:s)?)\b/i;
const BUYBACK=/\b(buyback|share repurchase|stock repurchase)\b/i;
const BUYBACK_ACTION=/\b(announc(?:e|es|ed)|authoriz(?:e|es|ed)|expand(?:s|ed)?|increase[sd]?|launch(?:es|ed)?)\b/i;
const CUSTOMER_NEG=/\b(?:loss|lost|loses|losing)\s+(?:of\s+)?(?:a\s+)?(?:major\s+|key\s+)?customer\b|\b(?:customer|client)\b.{0,35}\b(?:terminat(?:e|es|ed)|cancel(?:s|ed)?|ends?|leaves?)\b/i;
const CUSTOMER_POS=/\b(?:wins?|lands?|adds?|secure(?:s|d)?|signs?)\b.{0,45}\b(?:new\s+|major\s+|key\s+)?(?:customer|client)\b|\b(?:customer|client)\b.{0,35}\b(?:award(?:s|ed)?|expands?|renews?)\b/i;

function money(raw:string,suffix:string|undefined){
 const n=Number(raw.replace(/,/g,""));if(!Number.isFinite(n))return null;
 const m=!suffix?1:suffix.toUpperCase()==="K"?1e3:suffix.toUpperCase()==="M"?1e6:suffix.toUpperCase()==="B"?1e9:suffix.toUpperCase()==="T"?1e12:1;
 return n*m;
}
export function parseReportedSurprises(text:string){
 const eps=text.match(/\bEPS\s+\$?(-?[0-9][0-9,.]*)\s+(?:beats?|miss(?:es|ed)?)\s+\$?(-?[0-9][0-9,.]*)\s+(?:estimate|consensus)/i);
 const rev=text.match(/\b(?:sales|revenue)\s+\$?(-?[0-9][0-9,.]*)([KMBT])?\s+(?:beats?|miss(?:es|ed)?)\s+\$?(-?[0-9][0-9,.]*)([KMBT])?\s+(?:estimate|consensus)/i);
 const epsActual=eps?money(eps[1],undefined):null,epsEstimate=eps?money(eps[2],undefined):null;
 const revActual=rev?money(rev[1],rev[2]):null,revEstimate=rev?money(rev[3],rev[4]):null;
 return {
  eps:epsActual!==null&&epsEstimate!==null&&epsEstimate!==0?{actual:epsActual,estimate:epsEstimate,surprise:(epsActual-epsEstimate)/Math.abs(epsEstimate)}:null,
  revenue:revActual!==null&&revEstimate!==null&&revEstimate!==0?{actual:revActual,estimate:revEstimate,surprise:(revActual-revEstimate)/Math.abs(revEstimate)}:null
 };
}
const MONTHS:Record<string,number>={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
export function parseEarningsDate(text:string,publishedAt:string){
 const patterns=[
  /(?:earnings|results)[^.!?]{0,45}\b(?:on|due|report(?:ed|ing)?|release(?:d|ing)?)?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?/i,
  /\breport(?:s|ing)?\s+(?:Q\d\s+)?earnings\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?/i
 ];
 const m=patterns.map(p=>text.match(p)).find(Boolean);if(!m)return null;
 const pub=new Date(publishedAt);if(!Number.isFinite(pub.getTime()))return null;
 const month=MONTHS[m[1].toLowerCase().replace(".","")];if(month===undefined)return null;
 let year=m[3]?Number(m[3]):pub.getUTCFullYear();
 let date=new Date(Date.UTC(year,month,Number(m[2]),12));
 if(!m[3]&&date.getTime()<pub.getTime()-2*86400000)date=new Date(Date.UTC(year+1,month,Number(m[2]),12));
 const days=(date.getTime()-pub.getTime())/86400000;
 return days>=-1&&days<=180?{scheduledDate:date.toISOString().slice(0,10),daysToEarnings:days}:null;
}
export function customerEventDirection(text:string){
 if(CUSTOMER_NEG.test(text))return -1;
 if(CUSTOMER_POS.test(text))return 1;
 return null;
}
export function guidanceDirection(text:string){
 if(!GUIDANCE.test(text))return null;
 if(GUIDANCE_DOWN.test(text))return -1;
 if(GUIDANCE_UP.test(text))return 1;
 return 0;
}

export async function observedMarketwideEventEvidence(now=new Date()){
 const sql=db(),availableAt=now.toISOString();
 const rows=await sql`select article_id,published_at,headline,summary,symbols,source_name
   from tradeos_news_articles where published_at>=now()-interval '7 days' order by published_at desc limit 1000`;
 const articles:CachedArticle[]=rows.map(r=>({article_id:String(r.article_id),published_at:new Date(r.published_at as string).toISOString(),headline:String(r.headline),summary:String(r.summary??""),symbols:Array.isArray(r.symbols)?r.symbols as string[]:[],source_name:String(r.source_name)}));
 const candidates:PersistableEvidence[]=[];
 const symbolTotals=new Map<string,number>(),symbolTariffs=new Map<string,CachedArticle[]>();
 for(const a of articles)for(const symbol of a.symbols){
  symbolTotals.set(symbol,(symbolTotals.get(symbol)??0)+1);
  if(TARIFF.test(a.headline+" "+a.summary)){const arr=symbolTariffs.get(symbol)??[];arr.push(a);symbolTariffs.set(symbol,arr);}
 }
 for(const [symbol,items] of symbolTariffs){
  const total=symbolTotals.get(symbol)??0;if(!total||!items.length)continue;
  const latest=items.map(x=>x.published_at).sort().at(-1)!;
  candidates.push({factor:"tariff_exposure",value:items.length/total,source:"Persisted Alpaca/Massive news cache",subject:symbol,observedAt:latest,availableAt,domain:"news",metadata:{method:"share_of_symbol_news_explicitly_referencing_tariffs_or_trade_restrictions",windowDays:7,matchedArticles:items.length,totalArticles:total,articleIds:items.map(x=>x.article_id),unit:"fraction"}});
 }
 for(const a of articles){
  if(!a.symbols.length)continue;
  const text=a.headline+" "+a.summary;
  const surprises=parseReportedSurprises(text);
  // Company-specific structured events require an unambiguous single-symbol article.
  // Multi-symbol articles remain usable for market-wide exposure measures (for example tariff exposure) but not for issuer events.
  if(a.symbols.length!==1)continue;
  for(const symbol of a.symbols){
   const base={articleId:a.article_id,headline:a.headline,sourceName:a.source_name,symbolCount:1};
   if(surprises.eps)candidates.push({factor:"eps_surprise",value:surprises.eps.surprise,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,...surprises.eps,unit:"fraction_vs_reported_estimate"}});
   if(surprises.revenue)candidates.push({factor:"revenue_surprise",value:surprises.revenue.surprise,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,...surprises.revenue,unit:"fraction_vs_reported_estimate"}});
   const earnings=parseEarningsDate(text,a.published_at);
   if(earnings)candidates.push({factor:"earnings_date",value:earnings.daysToEarnings,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,scheduledDate:earnings.scheduledDate,unit:"calendar_days_from_publication"}});
   const gd=guidanceDirection(text);
   if(gd!==null)candidates.push({factor:"guidance_change",value:gd,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,unit:"direction_-1_0_1",method:"explicit_guidance_outlook_or_forecast_change"}});
   if(REGULATOR.test(text)&&REG_ACTION.test(text))candidates.push({factor:"regulatory_change",value:1,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,unit:"event",method:"explicit_named_regulator_action_headline_or_summary"}});
   if(BUYBACK.test(text)&&BUYBACK_ACTION.test(text))candidates.push({factor:"buyback_announcement",value:1,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,unit:"event",method:"explicit_buyback_or_repurchase_announcement"}});
   const customerDirection=customerEventDirection(text);
   if(customerDirection!==null)candidates.push({factor:"customer_event",value:customerDirection,source:a.source_name,subject:symbol,observedAt:a.published_at,availableAt,domain:"news",metadata:{...base,unit:"direction_-1_1",method:"explicit_customer_or_client_win_loss_event",note:"Requires explicit customer/client relationship language in a single-symbol article."}});
  }
 }
 const unique=new Map<string,PersistableEvidence>();
 for(const item of candidates){const article=String(item.metadata?.articleId??"");unique.set([item.factor,item.subject,article].join("|"),item);}
 return {retrievedAt:availableAt,articles:articles.length,candidates:[...unique.values()]};
}
