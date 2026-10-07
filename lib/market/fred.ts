export interface FredPoint{series:string;date:string;value:number|null}
const SERIES=["VIXCLS","DGS10","DFF"] as const;

function parseCsv(text:string):FredPoint[]{
  const lines=text.trim().split(/\r?\n/);
  if(lines.length<2)return[];
  const header=lines[0].split(",");
  const out:FredPoint[]=[];
  for(const line of lines.slice(1)){
    const cols=line.split(",");
    const date=cols[0];
    for(let i=1;i<header.length;i++){
      const raw=cols[i];
      const value=raw==="."||raw===""?null:Number(raw);
      out.push({series:header[i],date,value:Number.isFinite(value as number)?value:null});
    }
  }
  return out;
}

export async function latestRegimeContext(){
  const url="https://fred.stlouisfed.org/graph/fredgraph.csv?id="+SERIES.join(",");
  const res=await fetch(url,{next:{revalidate:3600}});
  if(!res.ok)throw new Error(`FRED HTTP ${res.status}`);
  const points=parseCsv(await res.text());
  const latest:any={};
  for(const s of SERIES){
    const vals=points.filter(p=>p.series===s&&p.value!==null);
    latest[s]=vals.length?vals[vals.length-1]:null;
  }
  return {
    source:"FRED",
    generatedAt:new Date().toISOString(),
    vix:latest.VIXCLS,
    tenYear:latest.DGS10,
    fedFunds:latest.DFF,
    note:"Daily-close/regime context, not an intraday trading feed."
  };
}
