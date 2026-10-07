export interface MicrostructureContext{
  symbol:string;feed:string;generatedAt:string;tradeCount:number;
  tapeAggressionScore:number|null;blockParticipationScore:number|null;
  signedVolumeRatio:number|null;largeTradeSignedRatio:number|null;medianTradeSize:number|null;
  note:string;
}
function median(xs:number[]){if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function clamp(n:number){return Math.max(0,Math.min(100,n))}
export async function microstructureContext(symbol:string):Promise<MicrostructureContext|null>{
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return null;
  const feed=process.env.ALPACA_FEED||"iex";
  const start=new Date(Date.now()-12*60*60*1000).toISOString();
  const url=new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades`);
  url.searchParams.set("start",start);url.searchParams.set("limit","5000");url.searchParams.set("feed",feed);url.searchParams.set("sort","asc");
  const res=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store"});
  if(!res.ok)throw new Error(`Alpaca trades HTTP ${res.status}`);
  const data=await res.json() as any; const trades=(data.trades??[]).filter((t:any)=>Number(t.p)>0&&Number(t.s)>0);
  if(trades.length<20)return{symbol,feed,generatedAt:new Date().toISOString(),tradeCount:trades.length,tapeAggressionScore:null,blockParticipationScore:null,signedVolumeRatio:null,largeTradeSignedRatio:null,medianTradeSize:null,note:"Insufficient trades in the most recent 12-hour window for a stable microstructure proxy."};
  let signed=0,total=0,lastPrice=Number(trades[0].p),lastSign=0;
  const sizes:number[]=[];const signedRows:{size:number,sign:number}[]=[];
  for(const t of trades){
    const p=Number(t.p),s=Number(t.s);let sign=p>lastPrice?1:p<lastPrice?-1:lastSign;
    if(sign===0)sign=1; signed+=sign*s;total+=s;sizes.push(s);signedRows.push({size:s,sign});lastPrice=p;lastSign=sign;
  }
  const ratio=total?signed/total:0;const med=median(sizes);
  const threshold=Math.max(500,(med??100)*5);const large=signedRows.filter(x=>x.size>=threshold);
  const largeTotal=large.reduce((s,x)=>s+x.size,0),largeSigned=large.reduce((s,x)=>s+x.size*x.sign,0);
  const largeRatio=largeTotal?largeSigned/largeTotal:null;
  const tape=clamp(50+ratio*45);const block=largeRatio==null?null:clamp(50+largeRatio*40);
  return{symbol,feed,generatedAt:new Date().toISOString(),tradeCount:trades.length,tapeAggressionScore:+tape.toFixed(1),blockParticipationScore:block==null?null:+block.toFixed(1),signedVolumeRatio:+ratio.toFixed(4),largeTradeSignedRatio:largeRatio==null?null:+largeRatio.toFixed(4),medianTradeSize:med,note:feed==="iex"?"IEX-only microstructure proxy from the most recent active 12-hour window; not consolidated tape or a current execution signal.":"Provider-feed microstructure proxy from the most recent active window."};
}