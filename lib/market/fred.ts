export interface FredPoint{series:string;date:string;value:number|null}
export interface FredSeriesResult{series:string;point:FredPoint|null;status:"ok"|"empty"|"error";error?:string}

function isoDate(d:Date){return d.toISOString().slice(0,10)}

async function latestSeries(series:string):Promise<FredSeriesResult>{
  const start=new Date(Date.now()-45*24*60*60*1000);
  const url=`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}&cosd=${isoDate(start)}`;
  try{
    // Keep this request intentionally plain. FRED's graph endpoint has proven reliable
    // from Vercel without custom request headers.
    const res=await fetch(url,{cache:"no-store"});
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
    note:"Official FRED daily observations; regime context only, not an intraday trading feed."
  };
}
