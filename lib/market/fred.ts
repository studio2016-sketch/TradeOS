export interface FredPoint{series:string;date:string;value:number|null}
export interface FredSeriesResult{series:string;point:FredPoint|null;status:"ok"|"empty"|"error";error?:string}

async function latestSeries(series:string):Promise<FredSeriesResult>{
  const url=`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`;
  try{
    const res=await fetch(url,{
      cache:"no-store",
      headers:{
        "Accept":"text/csv,*/*",
        "User-Agent":"TradeOS/1.0"
      },
      signal:AbortSignal.timeout(8000)
    });
    if(!res.ok)return{series,point:null,status:"error",error:`HTTP ${res.status}`};
    const text=await res.text();
    const lines=text.trim().split(/\r?\n/);
    for(let i=lines.length-1;i>=1;i--){
      const cols=lines[i].split(",");
      if(cols.length<2)continue;
      const raw=cols[1]?.trim();
      if(!raw||raw===".")continue;
      const value=Number(raw);
      if(Number.isFinite(value))return{series,point:{series,date:cols[0],value},status:"ok"};
    }
    return{series,point:null,status:"empty"};
  }catch(error){
    return{series,point:null,status:"error",error:error instanceof Error?error.message:String(error)};
  }
}

export async function latestRegimeContext(){
  // Fetch sequentially so one transient upstream failure cannot collapse all macro context.
  const vixResult=await latestSeries("VIXCLS");
  const tenYearResult=await latestSeries("DGS10");
  const fedFundsResult=await latestSeries("DFF");
  const diagnostics=[vixResult,tenYearResult,fedFundsResult];
  return {
    source:"FRED",
    generatedAt:new Date().toISOString(),
    vix:vixResult.point,
    tenYear:tenYearResult.point,
    fedFunds:fedFundsResult.point,
    diagnostics,
    usableCount:diagnostics.filter(x=>x.status==="ok").length,
    note:"Daily-close/regime context, not an intraday trading feed."
  };
}
