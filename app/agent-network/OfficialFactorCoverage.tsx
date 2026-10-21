"use client";
import {useEffect,useState} from "react";

type Factor={factor:string;series:string;label:string;unit:string;value:number|null;observedAt:string|null;status:"measured"|"unavailable";reason:string|null};
type Response={retrievedAt:string;measured:number;addedMeasured:number;addedTarget:number;addedFactors:Factor[];backtestEligible:boolean;approvedForTrading:boolean;warning:string};

export default function OfficialFactorCoverage(){
 const [data,setData]=useState<Response|null>(null),[error,setError]=useState("");
 async function refresh(){
  try{
   const response=await fetch("/api/research-acceleration/macro-evidence",{cache:"no-store"});
   if(!response.ok)throw Error(response.status===403?"Verified owner session required":"Live official-factor check unavailable");
   setData(await response.json());setError("");
  }catch(e){setData(null);setError(e instanceof Error?e.message:"Live official-factor check unavailable");}
 }
 useEffect(()=>{void refresh();},[]);
 return <section style={{marginTop:24,padding:22,border:"1px solid #5f91a5",borderRadius:14,background:"#102a39"}}>
  <h2>Live Official Macro Factor Coverage</h2>
  <p>Ten additional catalog factors are requested directly from current-vintage FRED observations. A factor counts only when the source returns a finite value with an observation date.</p>
  <button type="button" onClick={()=>void refresh()} style={{padding:"10px 15px"}}>Refresh official measurements</button>
  {error&&<p role="status">{error}</p>}
  {data&&<><div style={{fontSize:28,fontWeight:800,margin:"14px 0"}}>{data.addedMeasured} / {data.addedTarget} added factors live</div>
   <p style={{fontSize:12}}>Retrieved {new Date(data.retrievedAt).toLocaleString()} · {data.measured} official macro catalog factors currently measurable</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:9}}>{data.addedFactors.map(f=><article key={f.factor} style={{padding:12,border:"1px solid #527083",borderRadius:9}}>
    <strong>{f.label}</strong><div style={{fontSize:12,color:f.status==="measured"?"#8fe0b7":"#e8c77b"}}>{f.status.toUpperCase()} · {f.factor}</div>
    <div>{f.value==null?"Unavailable":`${Number(f.value).toLocaleString(undefined,{maximumFractionDigits:3})} ${f.unit}`}</div>
    <small>{f.series}{f.observedAt?` · observed ${f.observedAt}`:` · ${f.reason??"no observation"}`}</small>
   </article>)}</div>
   <p style={{fontSize:12,lineHeight:1.6}}>{data.warning}</p></>}
 </section>;
}
