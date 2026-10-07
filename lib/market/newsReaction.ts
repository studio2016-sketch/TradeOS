import {curatedNews} from "./news";
import {historicalBars} from "./features";

export interface NewsReactionContext{
  symbol:string;generatedAt:string;matched:boolean;
  headline:string|null;timestamp:string|null;returnPct:number|null;reactionScore:number|null;
  classification:string;note:string;
}
function clamp(n:number){return Math.max(0,Math.min(100,n))}
export async function latestNewsReaction(symbol:string):Promise<NewsReactionContext|null>{
  if(!process.env.ALPACA_API_KEY&&!process.env.MASSIVE_API_KEY)return null;
  const {news}=await curatedNews([symbol],20);
  if(!news.length)return{symbol,generatedAt:new Date().toISOString(),matched:false,headline:null,timestamp:null,returnPct:null,reactionScore:null,classification:"none",note:"No recent provider news available."};
  for(const item of news){
    const t=new Date(item.timestamp);
    if(Number.isNaN(t.getTime()))continue;
    const start=new Date(t.getTime()-10*60*1000).toISOString();
    const end=new Date(t.getTime()+120*60*1000).toISOString();
    const bars=await historicalBars(symbol,"5Min",start,1000).catch(()=>[]);
    const relevant=bars.filter(b=>{
      const bt=new Date(b.t).getTime();return bt>=t.getTime()-10*60*1000&&bt<=t.getTime()+120*60*1000;
    });
    if(relevant.length<2)continue;
    const pre=relevant.find(b=>new Date(b.t).getTime()>=t.getTime()-10*60*1000)??relevant[0];
    const post=relevant[relevant.length-1];
    if(!(pre.c>0&&post.c>0))continue;
    const ret=(post.c-pre.c)/pre.c*100;
    const mag=Math.min(50,Math.abs(ret)*12);
    const directional=ret>=0?50+mag:50-mag;
    return{
      symbol,generatedAt:new Date().toISOString(),matched:true,
      headline:item.headline,timestamp:item.timestamp,returnPct:+ret.toFixed(3),
      reactionScore:+clamp(directional).toFixed(1),
      classification:Math.abs(ret)<.3?"low-reaction":Math.abs(ret)<1?"moderate-reaction":"strong-reaction",
      note:"Reaction derived from provider-news timestamp and configured Alpaca 5-minute bars; context only, not causal proof."
    };
  }
  return{symbol,generatedAt:new Date().toISOString(),matched:false,headline:null,timestamp:null,returnPct:null,reactionScore:null,classification:"waiting",note:"No news item had enough surrounding bars for a measured reaction."};
}
