import {historicalBars} from "./features";
import {curatedNews} from "./news";

export type SubjectScope="symbol"|"sector"|"macro"|"global"|"regional";
export interface ResearchSubject{
  id:string;
  scope:SubjectScope;
  subject:string;
  symbols:string[];
  score:number;
  historicalScore:number|null;
  newsScore:number|null;
  expertScore:number|null;
  novelty:number;
  direction:"bullish"|"bearish"|"mixed"|"neutral";
  reasons:string[];
  evidence:any[];
  generatedAt:string;
}

export const DEFAULT_RESEARCH_UNIVERSE=[
  "SPY","QQQ","IWM","DIA","SMH","XLK","XLF","XLE","XLV","XLY","XLP","XLI","XLU","XLB","XLRE","XLC",
  "TLT","HYG","GLD","SLV","USO","UUP",
  "NVDA","AMD","AVGO","AAPL","MSFT","META","GOOGL","AMZN","TSLA","JPM","XOM","LLY","UNH","PLTR","ORCL","CAT","BA"
];

const themes:Array<[string,RegExp,string[]]>=[
  ["Artificial intelligence & semiconductors",/\b(ai|artificial intelligence|gpu|semiconductor|chip|data center|accelerator)\b/i,["SMH","NVDA","AMD","AVGO"]],
  ["Rates & duration",/\b(rate cut|rate hike|treasury|yield|bond|duration|fed|federal reserve)\b/i,["TLT","HYG","SPY"]],
  ["Energy & oil",/\b(oil|crude|opec|energy|natural gas|refinery|pipeline)\b/i,["XLE","XOM","USO"]],
  ["Banks & credit",/\b(bank|credit|lending|loan|default|delinquen|financial conditions)\b/i,["XLF","JPM","HYG"]],
  ["Consumer demand",/\b(consumer|retail|spending|demand|holiday sales|confidence)\b/i,["XLY","XLP","AMZN"]],
  ["Health care & biotech",/\b(health care|healthcare|biotech|drug|fda|clinical|medicare)\b/i,["XLV","LLY","UNH"]],
  ["Industrial cycle",/\b(industrial|manufacturing|factory|construction|capex|aerospace|defense)\b/i,["XLI","CAT","BA"]],
  ["Dollar & commodities",/\b(dollar|currency|forex|gold|silver|commodity|commodities)\b/i,["UUP","GLD","SLV"]],
  ["Geopolitical risk",/\b(war|sanction|tariff|missile|invasion|trade war|ceasefire|geopolitical)\b/i,["SPY","QQQ","GLD","USO"]],
  ["Real estate & financing",/\b(real estate|mortgage|housing|commercial property|reit)\b/i,["XLRE","TLT"]]
];

const expertRole=/\b(chief investment officer|cio|chief market strategist|market strategist|equity strategist|investment strategist|portfolio manager|fund manager|economist|analyst|research director|chief economist)\b/i;
const viewWords=/\b(expect|forecast|outlook|target|predict|sees|projects|bullish|bearish|overweight|underweight|upgrade|downgrade|recession|soft landing|risk|opportunity)\b/i;
const bullish=/\b(bullish|upside|outperform|overweight|upgrade|stronger|accelerat|growth|positive|rally)\b/i;
const bearish=/\b(bearish|downside|underperform|underweight|downgrade|weaker|slowdown|recession|negative|selloff)\b/i;

function clamp(n:number){return Math.max(0,Math.min(100,n))}
function sentiment(text:string){
  const p=bullish.test(text),n=bearish.test(text);
  return p&&!n?1:n&&!p?-1:0;
}
function roc(xs:number[],lookback:number){
  if(xs.length<=lookback)return null;
  const a=xs[xs.length-lookback-1],b=xs[xs.length-1];
  return a?((b-a)/a)*100:null;
}

export async function historicalResearchProfile(symbol:string){
  const end=new Date(Date.now()-16*60*1000).toISOString();
  const start=new Date(Date.now()-260*86400000).toISOString();
  const bars=await historicalBars(symbol,"1Day",start,300,"sip",end).catch(()=>[]);
  const closes=bars.map(x=>Number(x.c)).filter(x=>x>0);
  const vols=bars.map(x=>Number(x.v)).filter(x=>x>=0);
  if(closes.length<30)return null;
  const r5=roc(closes,5),r20=roc(closes,20),r60=roc(closes,60);
  const avg20=vols.slice(-20).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(20,vols.length));
  const lastVol=vols[vols.length-1]??0;
  const volumeRatio=avg20>0?lastVol/avg20:null;
  const trend=[r5,r20,r60].filter((x):x is number=>x!=null);
  const trendScore=trend.length?clamp(50+trend.reduce((s,x,i)=>s+x*[5,2.5,1.2][i],0)):null;
  const direction=trendScore==null?"neutral":trendScore>=62?"bullish":trendScore<=38?"bearish":"mixed";
  return{symbol,r5,r20,r60,volumeRatio,trendScore,direction,barCount:bars.length};
}

export function extractExpertViews(news:any[]){
  return news.filter(n=>{
    const text=(n.headline+" "+(n.summary||""));
    return expertRole.test(text)&&viewWords.test(text);
  }).map(n=>{
    const text=(n.headline+" "+(n.summary||""));
    return{
      id:"expert:"+n.id,
      timestamp:n.timestamp,
      source:n.source,
      headline:n.headline,
      symbols:n.symbols??[],
      direction:sentiment(text)>0?"bullish":sentiment(text)<0?"bearish":"neutral",
      score:+clamp(45+(n.sourceQuality??.6)*30+(n.recency??.5)*20+(n.relevance??.5)*5).toFixed(1),
      summary:n.summary||""
    };
  });
}

export async function discoverResearchSubjects(symbols:string[]){
  const universe=[...new Set(symbols.map(s=>s.toUpperCase()))];
  const profiles=(await Promise.all(universe.map(historicalResearchProfile))).filter(Boolean) as any[];
  const {news,errors}=await curatedNews(universe,50);
  const experts=extractExpertViews(news);
  const subjects:ResearchSubject[]=[];

  for(const p of profiles){
    const symbolNews=news.filter((n:any)=>n.symbols?.includes(p.symbol));
    const expert=experts.filter((n:any)=>n.symbols?.includes(p.symbol));
    const netNews=symbolNews.length?symbolNews.reduce((s:any,n:any)=>s+sentiment(n.headline+" "+(n.summary||""))*(n.rank??.5),0)/symbolNews.length:0;
    const newsScore=symbolNews.length?clamp(50+netNews*35):null;
    const expertNet=expert.length?expert.reduce((s:any,n:any)=>s+(n.direction==="bullish"?1:n.direction==="bearish"?-1:0)*n.score,0)/expert.length:0;
    const expertScore=expert.length?clamp(50+expertNet*.35):null;
    const hist=Number(p.trendScore);
    const components=[hist,newsScore,expertScore].filter((x):x is number=>x!=null);
    const score=components.length?components.reduce((a,b)=>a+b,0)/components.length:50;
    const novelty=Math.min(100,35+symbolNews.length*5+expert.length*10+Math.min(25,Math.abs(Number(p.r20??0))*2));
    if(score>=62||score<=38||novelty>=70){
      subjects.push({
        id:`symbol:${p.symbol}:${new Date().toISOString().slice(0,13)}`,
        scope:"symbol",subject:p.symbol,symbols:[p.symbol],
        score:+score.toFixed(1),historicalScore:+hist.toFixed(1),newsScore:newsScore==null?null:+newsScore.toFixed(1),expertScore:expertScore==null?null:+expertScore.toFixed(1),
        novelty:+novelty.toFixed(1),
        direction:score>=62?"bullish":score<=38?"bearish":"mixed",
        reasons:[
          `20-day price change ${p.r20==null?"n/a":Number(p.r20).toFixed(2)+"%"}`,
          `60-day price change ${p.r60==null?"n/a":Number(p.r60).toFixed(2)+"%"}`,
          symbolNews.length+` recent provider-news item(s)`,
          expert.length+` expert/strategist view(s)`
        ],
        evidence:[{type:"historical",...p},...symbolNews.slice(0,3),...expert.slice(0,2)],
        generatedAt:new Date().toISOString()
      });
    }
  }

  for(const [theme,re,themeSymbols] of themes){
    const items=news.filter((n:any)=>re.test(n.headline+" "+(n.summary||"")));
    const exp=experts.filter((n:any)=>re.test(n.headline+" "+(n.summary||"")));
    if(!items.length&&!exp.length)continue;
    const net=items.reduce((s:any,n:any)=>s+sentiment(n.headline+" "+(n.summary||""))*(n.rank??.5),0)/Math.max(1,items.length);
    const score=clamp(50+net*30+Math.min(12,items.length*1.5)+Math.min(10,exp.length*2));
    subjects.push({
      id:`theme:${theme.toLowerCase().replace(/[^a-z0-9]+/g,"-")}:${new Date().toISOString().slice(0,13)}`,
      scope:theme.includes("Geopolitical")?"global":"sector",
      subject:theme,symbols:themeSymbols,
      score:+score.toFixed(1),historicalScore:null,newsScore:+clamp(50+net*35).toFixed(1),expertScore:exp.length?+clamp(55+exp.reduce((s:any,x:any)=>s+x.score,0)/exp.length*.35).toFixed(1):null,
      novelty:+clamp(40+items.length*4+exp.length*8).toFixed(1),
      direction:net>.12?"bullish":net<-.12?"bearish":"mixed",
      reasons:[items.length+" relevant news item(s)",exp.length+" expert/strategist view(s)"],
      evidence:[...items.slice(0,5),...exp.slice(0,3)],
      generatedAt:new Date().toISOString()
    });
  }

  subjects.sort((a,b)=>(b.novelty+b.score*.35)-(a.novelty+a.score*.35));
  return{generatedAt:new Date().toISOString(),universeSize:universe.length,profileCount:profiles.length,newsCount:news.length,expertViewCount:experts.length,subjects:subjects.slice(0,24),experts:experts.slice(0,30),errors};
}
