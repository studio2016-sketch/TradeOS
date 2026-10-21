"use client";
import {useEffect,useState} from "react";

type Gate={id:string;label:string;state:"PASS"|"PRELIMINARY"|"BLOCKED";observed:string;requirement:string;implication:string};
type Response={generatedAt:string;assessment:{predictiveCertification:string;approvedModelInfluence:boolean;liveExecutionAllowed:boolean;counts:Record<string,number>;gates:Gate[];nextMilestone:string};prospective:{pairedCount:number;independentSessionDates:number;pairedBrierImprovement:number|null;clustered95PctInterval:[number,number]|null};policy:string};

export default function ScientificValidation(){
 const [data,setData]=useState<Response|null>(null),[error,setError]=useState("");
 async function refresh(){try{const r=await fetch("/api/scientific-validation",{cache:"no-store"});if(!r.ok)throw Error(r.status===403?"Verified owner session required":"Scientific validation audit unavailable");setData(await r.json());setError("");}catch(e){setData(null);setError(e instanceof Error?e.message:"Scientific validation audit unavailable");}}
 useEffect(()=>{void refresh();},[]);
 const color=(state:Gate["state"])=>state==="PASS"?"#8fe0b7":state==="PRELIMINARY"?"#e8c77b":"#f29b9b";
 return <section style={{marginTop:24,padding:22,border:"1px solid #b68585",borderRadius:14,background:"#152534"}}>
  <h2>Scientific Validation Authority</h2>
  <p>Live, fail-closed review of temporal integrity, sample independence, frozen prospective testing, multiple comparisons, costs, replay, and brokerage reconciliation.</p>
  <button type="button" onClick={()=>void refresh()} style={{padding:"10px 15px"}}>Refresh validation evidence</button>
  {error&&<p role="status">{error}</p>}
  {data&&<><div style={{margin:"14px 0",fontSize:25,fontWeight:800,color:"#f29b9b"}}>Predictive certification: {data.assessment.predictiveCertification}</div>
   <p>{data.assessment.counts.PASS} gates passed · {data.assessment.counts.PRELIMINARY} preliminary · {data.assessment.counts.BLOCKED} blocked</p>
   <p><strong>Next milestone:</strong> {data.assessment.nextMilestone}</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10}}>{data.assessment.gates.map(g=><article key={g.id} style={{padding:13,border:"1px solid #587084",borderRadius:9}}>
    <strong>{g.label}</strong><div style={{color:color(g.state),fontWeight:800,fontSize:12}}>{g.state}</div><p style={{fontSize:13}}>{g.observed}</p><small>Requirement: {g.requirement}</small><small style={{display:"block",marginTop:7,color:"#a9c1d0"}}>{g.implication}</small>
   </article>)}</div>
   <p style={{fontSize:12,marginTop:14}}>Prospective ledger: {data.prospective.pairedCount} pairs · {data.prospective.independentSessionDates} sessions · improvement {data.prospective.pairedBrierImprovement==null?"not estimable":data.prospective.pairedBrierImprovement.toFixed(6)} · clustered interval {data.prospective.clustered95PctInterval?data.prospective.clustered95PctInterval.map(x=>x.toFixed(6)).join(" to "):"withheld until depth gates pass"}.</p>
   <p style={{fontSize:12}}>{data.policy} Audited {new Date(data.generatedAt).toLocaleString()}.</p></>}
 </section>;
}
