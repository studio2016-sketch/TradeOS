"use client";
import {useEffect,useMemo,useState} from "react";

export default function MarketSparkline({symbol}:{symbol:string}){
  const [series,setSeries]=useState<any>(null);
  const [quote,setQuote]=useState<any>(null);
  const [busy,setBusy]=useState(true);
  const [seenAt,setSeenAt]=useState<string|null>(null);

  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      try{
        const [a,b]=await Promise.all([
          fetch("/api/chart?symbol="+encodeURIComponent(symbol)+"&minutes=480&timeframe=1Min",{cache:"no-store"}),
          fetch("/api/market?symbols="+encodeURIComponent(symbol),{cache:"no-store"})
        ]);
        const [chart,market]=await Promise.all([a.json(),b.json()]);
        if(!alive)return;
        setSeries(chart);
        setQuote(market?.snapshots?.find((x:any)=>x.symbol===symbol)||null);
        setSeenAt(new Date().toISOString());
      }finally{if(alive)setBusy(false)}
    };
    refresh();
    const id=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},30000);
    return()=>{alive=false;window.clearInterval(id)};
  },[symbol]);

  const g=useMemo(()=>{
    const raw=(series?.points??[]).map((p:any)=>({t:p.t,c:Number(p.c)})).filter((p:any)=>Number.isFinite(p.c)&&p.c>0);
    if(quote?.price>0&&quote?.timestamp){
      const last=raw[raw.length-1];
      if(!last||Date.parse(quote.timestamp)>Date.parse(last.t))raw.push({t:quote.timestamp,c:Number(quote.price)});
    }
    if(raw.length<2)return null;
    const pts=raw.slice(-120);
    const lo=Math.min(...pts.map((p:any)=>p.c)),hi=Math.max(...pts.map((p:any)=>p.c)),span=Math.max(.0001,hi-lo);
    const xy=pts.map((p:any,i:number)=>({x:(i/(pts.length-1))*100,y:88-((p.c-lo)/span)*76}));
    const first=pts[0].c,last=pts[pts.length-1].c;
    return{points:xy.map((p:any)=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" "),first,last,change:first?((last-first)/first)*100:0,lastTime:pts[pts.length-1].t};
  },[series,quote]);

  const freshness=quote?.freshness||series?.freshness||"unavailable";
  return <article className="card sparkCard" aria-label={symbol+" intraday market chart"}>
    <div><b>{symbol}</b><strong>{g?"$"+g.last.toFixed(2):busy?"Loading…":"—"}</strong></div>
    {g?<svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:"100%",height:64,display:"block",margin:"8px 0 6px"}} role="img" aria-label={symbol+" one minute price trend"}><polyline points={g.points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg>:<div style={{height:64,display:"grid",placeItems:"center",color:"#81939d",fontSize:11}}>No intraday series available</div>}
    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}><span style={{fontSize:11,fontWeight:800}}>{g?(g.change>=0?"+":"")+g.change.toFixed(2)+"%":"—"}</span><small>{freshness.replaceAll("_"," ")}</small></div>
    <small style={{display:"block",marginTop:5}}>{g?new Date(g.lastTime).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):seenAt?"Checked "+new Date(seenAt).toLocaleTimeString():"Waiting"} · {series?.source||quote?.source||"provider pending"}</small>
  </article>;
}
