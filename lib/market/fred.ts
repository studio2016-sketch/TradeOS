export interface FredPoint{series:string;date:string;value:number|null}
const SERIES=["VIXCLS","DGS10","DFF"] as const;

async function latestSeries(series:string):Promise<FredPoint|null>{
  const url=`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`;
  const res=await fetch(url,{next:{revalidate:3600},headers:{"User-Agent":"TradeOS/1.0 market research"}});
  if(!res.ok)throw new Error(`FRED ${series} HTTP ${res.status}`);
  const text=await res.text();
  const lines=text.trim().split(/\r?\n/);
  if(lines.length<2)return null;
  for(let i=lines.length-1;i>=1;i--){
    const cols=lines[i].split(",");
    if(cols.length<2)continue;
    const raw=cols[1]?.trim();
    if(!raw||raw===".")continue;
    const value=Number(raw);
    if(Number.isFinite(value))return{series,date:cols[0],value};
  }
  return null;
}

export async function latestRegimeContext(){
  const [vix,tenYear,fedFunds]=await Promise.all([
    latestSeries("VIXCLS"),
    latestSeries("DGS10"),
    latestSeries("DFF")
  ]);
  return {
    source:"FRED",
    generatedAt:new Date().toISOString(),
    vix,
    tenYear,
    fedFunds,
    note:"Daily-close/regime context, not an intraday trading feed."
  };
}
