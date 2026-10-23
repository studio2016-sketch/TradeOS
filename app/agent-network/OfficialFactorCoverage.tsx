"use client";
import {useEffect,useState} from "react";

type Evidence={factor:string;value:number;domain:string;source:string;observedAt:string;availableAt:string;subject:string};
type Response={generatedAt:string;measurementWindowHours:number;measured:number;defined:number;operationalTarget:number;targetMet:boolean;coveragePct:number;domains:Record<string,number>;evidence:Evidence[];warning:string};

export default function OfficialFactorCoverage(){
 const [data,setData]=useState<Response|null>(null),[error,setError]=useState("");
 async function refresh(){
  try{
   const response=await fetch("/api/research-acceleration/coverage",{cache:"no-store"});
   if(!response.ok)throw Error(response.status===403?"Verified owner session required":"Live official-factor check unavailable");
   setData(await response.json());setError("");
  }catch(e){setData(null);setError(e instanceof Error?e.message:"Live official-factor check unavailable");}
 }
 useEffect(()=>{void refresh();},[]);
 return <section style={{marginTop:24,padding:22,border:"1px solid #5f91a5",borderRadius:14,background:"#102a39"}}>
  <h2>Measured 120-Factor Coverage</h2>
  <p>Coverage counts only finite, timestamped, provenance-backed observations persisted during the latest 24-hour evidence window.</p>
  <button type="button" onClick={()=>void refresh()} style={{padding:"10px 15px"}}>Refresh measured coverage</button>
  {error&&<p role="status">{error}</p>}
  {data&&<><div style={{fontSize:28,fontWeight:800,margin:"14px 0",color:data.targetMet?"#8fe0b7":"#e8c77b"}}>{data.measured} / {data.defined} factors measured · 60 target {data.targetMet?"MET":"NOT YET MET"}</div>
   <p style={{fontSize:12}}>Audited {new Date(data.generatedAt).toLocaleString()} · {data.coveragePct}% catalog coverage · {Object.entries(data.domains).map(([domain,count])=>`${domain} ${count}`).join(" · ")}</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:9}}>{data.evidence.map(f=><article key={f.factor} style={{padding:12,border:"1px solid #527083",borderRadius:9}}>
    <strong>{f.factor.replaceAll("_"," ")}</strong><div style={{fontSize:12,color:"#8fe0b7"}}>MEASURED · {f.domain.toUpperCase()}</div>
    <div>{Number(f.value).toLocaleString(undefined,{maximumFractionDigits:4})}</div>
    <small>{f.source} · {f.subject} · observed {new Date(f.observedAt).toLocaleString()} · available {new Date(f.availableAt).toLocaleString()}</small>
   </article>)}</div>
   <p style={{fontSize:12,lineHeight:1.6}}>{data.warning}</p></>}
 </section>;
}
