"use client";
import {useCallback,useEffect,useState} from "react";
type Point={t:string;c:number;v:number};
export default function IntradayChart({symbol}:{symbol:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[pollAt,setPollAt]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState<number|null>(null);
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const r=await fetch("/api/chart?symbol="+encodeURIComponent(symbol)+"&minutes=4320",{cache:"no-store"});
   const j=await r.json();if(!r.ok||j.mode!=="provider_history")throw Error(j.error||"No intraday bars returned by Alpaca");
   setData(j);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Data unavailable");setData(null)}
  finally{setPollAt(new Date().toISOString());setBusy(false)}
 },[symbol]);
 useEffect(()=>{setData(null);setSelected(null);refresh();const id=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},30000);return()=>window.clearInterval(id)},[refresh]);
 const points:Point[]=(data?.points||[]).filter((p:Point)=>Number.isFinite(p.c)&&p.c>0&&Number.isFinite(Date.parse(p.t)));
 const last=points.at(-1);
 const min=points.length?Math.min(...points.map(p=>p.c)):0,max=points.length?Math.max(...points.map(p=>p.c)):1;
 const x=(i:number)=>20+560*i/Math.max(1,points.length-1),y=(v:number)=>175-145*(v-min)/(max-min||1);
 const chosen=selected!==null?points[selected]:null;
 return <section style={{background:"#0b202e",border:"1px solid #345466",borderRadius:15,padding:18,marginTop:18}}>
 <div style={{display:"flex",gap:15,justifyContent:"space-between",flexWrap:"wrap"}}><div><strong>{symbol} · 5-minute historical market bars</strong><p style={{fontSize:12,color:"#aec5d5"}}>Source: {data?.source||"Unavailable"} · Last published bar: {last?new Date(last.t).toLocaleString():"Unavailable"}<br/>Last checked: {pollAt?new Date(pollAt).toLocaleTimeString():"Not checked"} · {data?.freshness||"unavailable"}</p></div><button type="button" onClick={refresh} disabled={busy}>{busy?"Updating…":"Refresh chart"}</button></div>
 {error?<p role="status" style={{color:"#f4b1a3"}}>{error}. The app will not invent price movement.</p>:points.length<2?<p>Waiting for sufficient provider bars…</p>:<><svg viewBox="0 0 620 220" width="100%" role="img" aria-label={"Five-minute historical price chart for "+symbol+" with "+points.length+" observations"} style={{background:"#081722",borderRadius:9}}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="20" x2="585" y1={25+i*37} y2={25+i*37} stroke="#294556"/><text x="589" y={29+i*37} fill="#aac6d4" fontSize="10">{(max-(max-min)*i/4).toFixed(2)}</text></g>)}
 <polyline fill="none" stroke="#66cdb9" strokeWidth="2" points={points.map((p,i)=>x(i)+","+y(p.c)).join(" ")}/>
 {points.map((p,i)=><circle key={p.t} role="button" tabIndex={0} aria-label={new Date(p.t).toLocaleString()+" close "+p.c.toFixed(2)} cx={x(i)} cy={y(p.c)} r={selected===i?5:3} fill={selected===i?"#f5d998":"transparent"} style={{cursor:"pointer"}} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(i)}}}/>)}
 <text x="22" y="206" fontSize="11" fill="#abcbd5">{points[0]?.t.slice(0,16).replace("T"," ")}</text><text x="450" y="206" fontSize="11" fill="#abcbd5">{last?.t.slice(0,16).replace("T"," ")}</text></svg>
 <p role="status">{chosen?new Date(chosen.t).toLocaleString()+" · Close $"+chosen.c.toFixed(2)+" · Volume "+chosen.v.toLocaleString():"Last published close $"+last?.c.toFixed(2)+". Select points for details."}</p></>}
 <p style={{fontSize:12,color:"#a4b9c7"}}>Requests fresh bars every 30 seconds while visible; chart changes only when the provider publishes a new observation. Five-minute bars are not tick streaming.</p>
 </section>;
}
