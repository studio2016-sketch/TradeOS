export interface OptionSurface{
  provider:string;
  feed:string;
  underlying:string;
  contractCount:number;
  quoteCoverage:number;
  averageSpreadPct:number|null;
  atmIv:number|null;
  putCallIvSkew:number|null;
  expectedMovePct30d:number|null;
  liquidityScore:number|null;
  volatilitySuitability:number|null;
  dealerGammaProxy:null;
  note:string;
  generatedAt:string;
}

function iso(d:Date){return d.toISOString().slice(0,10)}
function median(xs:number[]){
  if(!xs.length)return null;
  const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function occ(symbol:string){
  const m=symbol.match(/^([A-Z0-9.]+)(\d{6})([CP])(\d{8})$/);
  if(!m)return null;
  const yy=Number(m[2].slice(0,2)),mm=Number(m[2].slice(2,4)),dd=Number(m[2].slice(4,6));
  return{root:m[1],expiry:new Date(Date.UTC(2000+yy,mm-1,dd)),type:m[3]==="C"?"call":"put",strike:Number(m[4])/1000};
}

export async function alpacaOptionSurface(underlying:string,spot?:number):Promise<OptionSurface|null>{
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return null;
  const feed=process.env.ALPACA_OPTIONS_FEED||"indicative";
  const start=new Date(),end=new Date(Date.now()+45*24*60*60*1000);
  const url=new URL("https://data.alpaca.markets/v1beta1/options/snapshots/"+encodeURIComponent(underlying));
  url.searchParams.set("feed",feed);
  url.searchParams.set("expiration_date_gte",iso(start));
  url.searchParams.set("expiration_date_lte",iso(end));
  url.searchParams.set("limit","1000");
  const res=await fetch(url,{
    headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},
    cache:"no-store"
  });
  if(!res.ok)throw new Error(`Alpaca option chain HTTP ${res.status}`);
  const data=await res.json() as any;
  const entries=Object.entries(data.snapshots??{}) as [string,any][];
  if(!entries.length)return{
    provider:"Alpaca",feed,underlying,contractCount:0,quoteCoverage:0,averageSpreadPct:null,
    atmIv:null,putCallIvSkew:null,expectedMovePct30d:null,liquidityScore:null,volatilitySuitability:null,
    dealerGammaProxy:null,note:"No option snapshots returned for requested horizon.",generatedAt:new Date().toISOString()
  };

  const rows=entries.map(([symbol,s]:any)=>{
    const meta=occ(symbol);
    const q=s?.latestQuote??s?.latest_quote??{};
    const bid=Number(q.bp??q.bid_price??0),ask=Number(q.ap??q.ask_price??0);
    const mid=bid>0&&ask>0?(bid+ask)/2:0;
    const spreadPct=mid>0?(ask-bid)/mid*100:null;
    const iv=Number(s?.impliedVolatility??s?.implied_volatility??NaN);
    const delta=Number(s?.greeks?.delta??NaN);
    return{symbol,meta,bid,ask,spreadPct,iv:Number.isFinite(iv)?iv:null,delta:Number.isFinite(delta)?delta:null};
  });

  const quoted=rows.filter(r=>r.bid>0&&r.ask>0&&r.spreadPct!=null);
  const quoteCoverage=rows.length?quoted.length/rows.length:0;
  const avgSpread=quoted.length?quoted.reduce((s,r)=>s+(r.spreadPct as number),0)/quoted.length:null;
  const atm=rows.filter(r=>{
    if(r.iv==null)return false;
    if(r.delta!=null)return Math.abs(Math.abs(r.delta)-.5)<=.15;
    if(spot&&r.meta)return Math.abs(r.meta.strike-spot)/spot<=.05;
    return false;
  });
  const atmIv=median(atm.map(r=>r.iv as number));
  const puts=rows.filter(r=>r.iv!=null&&r.meta?.type==="put"&&(r.delta==null||Math.abs(r.delta)>=.15&&Math.abs(r.delta)<=.4));
  const calls=rows.filter(r=>r.iv!=null&&r.meta?.type==="call"&&(r.delta==null||Math.abs(r.delta)>=.15&&Math.abs(r.delta)<=.4));
  const putIv=median(puts.map(r=>r.iv as number)),callIv=median(calls.map(r=>r.iv as number));
  const skew=putIv!=null&&callIv!=null?putIv-callIv:null;
  const expectedMovePct30d=atmIv==null?null:atmIv*Math.sqrt(30/365)*100;

  let liquidityScore:number|null=null;
  if(avgSpread!=null){
    const spreadScore=avgSpread<=3?95:avgSpread<=7?82:avgSpread<=15?65:avgSpread<=30?45:25;
    liquidityScore=Math.max(0,Math.min(100,.65*spreadScore+.35*quoteCoverage*100));
  }
  const volatilitySuitability=expectedMovePct30d==null?null:
    expectedMovePct30d<=6?85:expectedMovePct30d<=10?75:expectedMovePct30d<=16?58:38;

  return{
    provider:"Alpaca",feed,underlying,contractCount:rows.length,quoteCoverage:+(quoteCoverage*100).toFixed(1),
    averageSpreadPct:avgSpread==null?null:+avgSpread.toFixed(2),
    atmIv:atmIv==null?null:+atmIv.toFixed(4),
    putCallIvSkew:skew==null?null:+skew.toFixed(4),
    expectedMovePct30d:expectedMovePct30d==null?null:+expectedMovePct30d.toFixed(2),
    liquidityScore:liquidityScore==null?null:+liquidityScore.toFixed(1),
    volatilitySuitability:volatilitySuitability==null?null:+volatilitySuitability.toFixed(1),
    dealerGammaProxy:null,
    note:feed==="opra"?"Real-time OPRA option surface.":"Indicative option feed; use for context, not execution-quality confirmation.",
    generatedAt:new Date().toISOString()
  };
}
