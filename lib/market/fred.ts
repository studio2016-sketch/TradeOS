export interface FredPoint{series:string;date:string;value:number|null;previous?:number|null;changePct?:number|null}
export interface FredSeriesResult{series:string;point:FredPoint|null;status:"ok"|"empty"|"error";error?:string}
export interface FredHistoryResult{series:string;points:Array<{date:string;value:number}>;status:"ok"|"empty"|"error";error?:string}

function isoDate(d:Date){return d.toISOString().slice(0,10)}

export async function fredSeriesHistory(series:string,lookbackDays=60):Promise<FredHistoryResult>{
  const start=new Date(Date.now()-lookbackDays*24*60*60*1000);
  const url=`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}&cosd=${isoDate(start)}`;
  try{
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok)return{series,points:[],status:"error",error:`HTTP ${res.status}`};
    const text=await res.text();
    const lines=text.trim().split(/\r?\n/);
    const valid:{date:string,value:number}[]=[];
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(",");
      if(cols.length<2)continue;
      const raw=cols[1]?.trim();
      if(!raw||raw===".")continue;
      const value=Number(raw);
      if(Number.isFinite(value))valid.push({date:cols[0],value});
    }
    return valid.length?{series,points:valid,status:"ok"}:{series,points:[],status:"empty"};
  }catch(error){
    return{series,points:[],status:"error",error:error instanceof Error?error.message:String(error)};
  }
}

async function latestSeries(series:string):Promise<FredSeriesResult>{
  const result=await fredSeriesHistory(series);
  if(result.status!=="ok")return{series,point:null,status:result.status,error:result.error};
  const latest=result.points[result.points.length-1],previous=result.points.length>1?result.points[result.points.length-2]:null;
  const changePct=previous&&previous.value!==0?(latest.value-previous.value)/Math.abs(previous.value)*100:null;
  return{series,point:{series,date:latest.date,value:latest.value,previous:previous?.value??null,changePct},status:"ok"};
}

export async function latestRegimeContext(){
  const ids=["VIXCLS","DGS10","DGS2","T10Y2Y","DFF","DTWEXBGS","BAMLH0A0HYM2","DCOILWTICO"] as const;
  const results:Record<string,FredSeriesResult>={};
  // Sequential fetches have proven more reliable from the current serverless runtime.
  for(const id of ids)results[id]=await latestSeries(id);
  const diagnostics=Object.values(results);
  return {
    source:"FRED",
    generatedAt:new Date().toISOString(),
    vix:results.VIXCLS.point,
    tenYear:results.DGS10.point,
    twoYear:results.DGS2.point,
    curve10y2y:results.T10Y2Y.point,
    fedFunds:results.DFF.point,
    broadDollar:results.DTWEXBGS.point,
    highYieldSpread:results.BAMLH0A0HYM2.point,
    wti:results.DCOILWTICO.point,
    diagnostics,
    usableCount:diagnostics.filter(x=>x.status==="ok").length,
    note:"Official FRED daily observations; regime context only, not an intraday trading feed."
  };
}
