import {curatedNews} from "./news";
import {historicalBars} from "./features";
import {evidenceTimestamp} from '../research/evidence-time';
import {calculateNewsReaction,NEWS_REACTION_METHOD} from './news-reaction-engine';
import type {NewsSignal} from './types';

export interface NewsReactionContext{
  symbol:string;generatedAt:string;matched:boolean;
  headline:string|null;timestamp:string|null;returnPct:number|null;reactionScore:number|null;
  classification:string;note:string;
  measuredThrough?:string;
  methodVersion?:string;
  reactionEvidence?:Record<string,unknown>;
}
function clamp(n:number){return Math.max(0,Math.min(100,n))}
export async function latestNewsReaction(symbol:string,newsSnapshot?:NewsSignal[]):Promise<NewsReactionContext|null>{
  if(!process.env.ALPACA_API_KEY&&!process.env.MASSIVE_API_KEY)return null;
  return latestNewsReactionWithDependencies(symbol,{news:newsSnapshot===undefined?curatedNews:async()=>({news:newsSnapshot,errors:[]}),bars:historicalBars,clock:()=>new Date()},process.env.ALPACA_FEED||'iex');
}
type ReactionDependencies={news:(symbols:string[],limit:number)=>Promise<{news:NewsSignal[];errors:string[]}>;bars:typeof historicalBars;clock:()=>Date};
export async function latestNewsReactionWithDependencies(symbol:string,deps:ReactionDependencies,feed='iex'):Promise<NewsReactionContext>{
  const asOf=deps.clock().toISOString(),cutoff=evidenceTimestamp(asOf)!;
  const {news}=await deps.news([symbol],20);
  const articles=news.filter(n=>{const t=evidenceTimestamp(n.timestamp);return n.symbols.length===1&&n.symbols[0]===symbol&&t!==null&&t<=cutoff&&t>=cutoff-BigInt(86400000000000);})
    .sort((a,b)=>{const x=evidenceTimestamp(a.timestamp)!,y=evidenceTimestamp(b.timestamp)!;return x>y?-1:x<y?1:a.id<b.id?-1:a.id>b.id?1:0;}).slice(0,3);
  const complete=()=>{const t=deps.clock().toISOString();if(evidenceTimestamp(t)!<cutoff)throw Error('News reaction clock moved backwards');return t;};
  for(const item of articles){
    const t=evidenceTimestamp(item.timestamp)!;
    const start=new Date(Number((t-BigInt(600000000000))/BigInt(1000000))).toISOString();
    const end=new Date(Number((t+BigInt(7200000000000)<cutoff?t+BigInt(7200000000000):cutoff)/BigInt(1000000))).toISOString();
    let bars;
    try{bars=await deps.bars(symbol,'5Min',start,1000,feed,end,true,true);}catch{continue;}
    const measured=calculateNewsReaction(bars,item.timestamp,asOf);
    if(measured.status!=='MEASURED')continue;
    const ret=measured.rawReturnPct;
    const mag=Math.min(50,Math.abs(ret)*12);
    const directional=ret>=0?50+mag:50-mag;
    return{
      symbol,generatedAt:complete(),matched:true,methodVersion:NEWS_REACTION_METHOD,
      headline:item.headline,timestamp:item.timestamp,measuredThrough:measured.endpoint.closedAt,returnPct:measured.returnPct,
      reactionEvidence:{...measured,articleId:item.id,sourceName:item.source,feed},
      reactionScore:+clamp(directional).toFixed(1),
      classification:Math.abs(ret)<.3?"low-reaction":Math.abs(ret)<1?"moderate-reaction":"strong-reaction",
      note:"Descriptive return between completed nominal five-minute intervals before and after the article. Bar finality, historical availability and causality are not certified."
    };
  }
  return{symbol,generatedAt:complete(),matched:false,methodVersion:NEWS_REACTION_METHOD,headline:null,timestamp:null,returnPct:null,reactionScore:null,classification:articles.length?'waiting':'none',note:"No eligible single-issuer article had valid completed pre/post-news bars within the bounded request budget."};
}
