import {curatedNews} from "./news";

export interface NewsContext{
  symbol:string;generatedAt:string;itemCount:number;
  earningsScore:number|null;analystRevisionScore:number|null;sectorNarrativeScore:number|null;sentimentScore:number|null;eventAsymmetryScore:number|null;
  positiveCount:number;negativeCount:number;topHeadlines:Array<{headline:string;timestamp:string;source:string;score:number}>;
  note:string;
}
const sectorProxy:Record<string,string>={NVDA:"SMH",AMD:"SMH",AVGO:"SMH",INTC:"SMH",QCOM:"SMH",MU:"SMH",PLTR:"XLK",AAPL:"XLK",MSFT:"XLK",ORCL:"XLK",META:"XLC",GOOGL:"XLC",AMZN:"XLY",TSLA:"XLY",JPM:"XLF",BAC:"XLF",XOM:"XLE",CVX:"XLE",LLY:"XLV",UNH:"XLV"};
const POS=/\b(beat|beats|raise[sd]?|upgrade[sd]?|record|strong|growth|win[ns]?|approval|approved|partnership|expand[sd]?|surge[sd]?|bullish|outperform|buy rating|positive|accelerat(?:e|es|ed|ing))\b/i;
const NEG=/\b(miss|misses|cut[s]?|downgrade[sd]?|investigation|lawsuit|recall|weak|decline[sd]?|drop[s]?|delay[sed]?|bearish|underperform|sell rating|warning|slump|fall[s]?|risk[s]?)\b/i;
const EARN=/\b(earnings|guidance|revenue|eps|quarterly results|quarter results|profit|margin outlook|forecast)\b/i;
const ANALYST=/\b(upgrade|downgrade|price target|initiated|initiates|reiterate|maintain[sed]?|rating|outperform|underperform|overweight|underweight)\b/i;
function clamp(n:number){return Math.max(0,Math.min(100,n))}
function itemSentiment(text:string){
  let s=0;if(POS.test(text))s++;if(NEG.test(text))s--;return s;
}
export async function buildNewsContext(symbol:string):Promise<NewsContext|null>{
  if(!process.env.ALPACA_API_KEY&&!process.env.MASSIVE_API_KEY)return null;
  const proxy=sectorProxy[symbol];
  const {news}=await curatedNews(proxy?[symbol,proxy]:[symbol],40);
  if(!news.length)return{symbol,generatedAt:new Date().toISOString(),itemCount:0,earningsScore:null,analystRevisionScore:null,sectorNarrativeScore:null,sentimentScore:null,eventAsymmetryScore:null,positiveCount:0,negativeCount:0,topHeadlines:[],note:"No recent provider news matched the symbol/sector query."};
  const scored=news.map((n:any)=>{
    const text=(n.headline+" "+(n.summary||""));
    const sentiment=itemSentiment(text);
    const weight=(n.sourceQuality??.6)*(.55+.45*(n.recency??.5))*(.6+.4*(n.relevance??.5));
    return{...n,text,sentiment,weight};
  });
  const positive=scored.filter(x=>x.sentiment>0),negative=scored.filter(x=>x.sentiment<0);
  const denom=scored.reduce((s,x)=>s+x.weight,0)||1;
  const net=scored.reduce((s,x)=>s+x.sentiment*x.weight,0)/denom;
  const sentimentScore=clamp(50+net*35);
  const earnings=scored.filter(x=>EARN.test(x.text));
  const earningsNet=earnings.length?earnings.reduce((s,x)=>s+x.sentiment*x.weight,0)/(earnings.reduce((s,x)=>s+x.weight,0)||1):null;
  const earningsScore=earningsNet==null?null:clamp(50+earningsNet*38);
  const analyst=scored.filter(x=>ANALYST.test(x.text));
  const analystNet=analyst.length?analyst.reduce((s,x)=>s+x.sentiment*x.weight,0)/(analyst.reduce((s,x)=>s+x.weight,0)||1):null;
  const analystRevisionScore=analystNet==null?null:clamp(50+analystNet*40);
  const sectorItems=proxy?scored.filter(x=>x.symbols?.includes(proxy)||x.symbols?.length>3):scored;
  const sectorNet=sectorItems.length?sectorItems.reduce((s,x)=>s+x.sentiment*x.weight,0)/(sectorItems.reduce((s,x)=>s+x.weight,0)||1):0;
  const sectorNarrativeScore=clamp(50+sectorNet*30);
  const strongestPos=positive.length?Math.max(...positive.map(x=>x.weight)):0,strongestNeg=negative.length?Math.max(...negative.map(x=>x.weight)):0;
  const asym=(strongestPos-strongestNeg);
  const eventAsymmetryScore=clamp(50+asym*45);
  return{
    symbol,generatedAt:new Date().toISOString(),itemCount:scored.length,
    earningsScore,analystRevisionScore,sectorNarrativeScore,sentimentScore,eventAsymmetryScore,
    positiveCount:positive.length,negativeCount:negative.length,
    topHeadlines:scored.slice(0,8).map(x=>({headline:x.headline,timestamp:x.timestamp,source:x.source,score:+((x.rank??x.weight)*100).toFixed(1)})),
    note:"Deterministic headline context only. Price reaction and source provenance remain separate evidence."
  };
}
