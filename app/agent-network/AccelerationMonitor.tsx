"use client";
import {useEffect,useState} from "react";
type Status={snapshotCount:number;symbolsObserved:number;meanMeasuredFactorCount:number|null;historicalTrials:number;symbolsReplayed:number;rawTrialsBeatingBaseline:number;certifiedFindings:number;causalFindings:number;firstObserved:string|null;lastObserved:string|null;warning:string};
export default function AccelerationMonitor(){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState("");
 async function refresh(){try{const r=await fetch("/api/research-acceleration/status",{cache:"no-store"});if(!r.ok)throw Error("Verified owner session required or study not ready");setData(await r.json());setError("");}catch(e){setError(e instanceof Error?e.message:"Status unavailable");}}
 useEffect(()=>{void refresh();const t=setInterval(()=>void refresh(),120000);return()=>clearInterval(t)},[]);
 return <section style={{marginTop:18,padding:20,border:"1px solid #d9b477",borderRadius:14,background:"#112b38"}}>
 <h2>100-Stock Intelligence Sprint</h2><p>Automated evidence gathering plus historical replay. The system tracks data coverage and refuses to confuse correlation with causation.</p>
 <button type="button" onClick={()=>void refresh()} style={{padding:"10px 15px"}}>Refresh study status</button>
 {error&&<p role="status">{error}</p>}
 {data&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:14}}>
 {([["Actual snapshots",data.snapshotCount],["Securities observed",data.symbolsObserved],["Replay trials",data.historicalTrials],["Securities replayed",data.symbolsReplayed],["Factors measured avg.",data.meanMeasuredFactorCount==null?"Pending":data.meanMeasuredFactorCount.toFixed(1)+" / 120"],["Certified findings",data.certifiedFindings]] as const).map(([label,value])=><div key={label} style={{padding:12,border:"1px solid #547082",borderRadius:9}}><small>{label}</small><div style={{fontSize:23,fontWeight:700}}>{value}</div></div>)}</div>}
 {data&&<p style={{fontSize:12,lineHeight:1.6}}>{data.warning}</p>}
 </section>;
}
