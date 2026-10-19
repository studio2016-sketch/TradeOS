"use client";
import {useState} from "react";
const checks=["pointInTime","independentSource","costs","multipleTesting","independentReplay","holdoutLocked"] as const;
const labels=["Point-in-time data verified","Independent source verified","Costs and slippage included","Multiple testing controlled","Independent replay completed","Holdout locked before evaluation"];
export default function ProtocolReview(){
 const [investigationId,setInvestigationId]=useState(""),[sha256,setSha256]=useState(""),[p,setP]=useState<Record<string,string|boolean>>({primaryMetric:"",baseline:"",trainStart:"",trainEnd:"",holdoutStart:"",holdoutEnd:""}),[result,setResult]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setResult("Checking...");
  try{const r=await fetch("/api/research-certification/preflight",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId,sha256,protocol:p})});
   const b=await r.json();if(!r.ok)throw Error(b.error||"Review failed");
   setResult(b.decision+": "+(b.assessment.issues.join("; ")||"Protocol complete; independent empirical review still required.")+". Model promotion disabled.");
  }catch(e){setResult(e instanceof Error?e.message:"Review failed");}
 }
 return <section style={{padding:20,border:"1px solid #b99a61",marginTop:20,borderRadius:12,background:"#112d3a"}}><h3>Scientific Protocol Preflight</h3><p>Register prespecified review criteria. Passing this checklist never certifies a factor or enables live trading.</p>
 <form onSubmit={e=>void submit(e)}>
 <input required placeholder="Investigation UUID" value={investigationId} onChange={e=>setInvestigationId(e.target.value)} style={{width:"100%",padding:9}}/>
 <input required placeholder="Linked evidence SHA-256" value={sha256} onChange={e=>setSha256(e.target.value)} style={{width:"100%",padding:9,marginTop:8}}/>
 {["primaryMetric","baseline","trainStart","trainEnd","holdoutStart","holdoutEnd"].map(k=><label key={k} style={{display:"block",marginTop:10}}>{k}<input required type={k.includes("Start")||k.includes("End")?"date":"text"} value={String(p[k]??"")} onChange={e=>setP({...p,[k]:e.target.value})} style={{display:"block",width:"100%",padding:9}}/></label>)}
 {checks.map((k,i)=><label key={k} style={{display:"block",marginTop:10}}><input type="checkbox" checked={p[k]===true} onChange={e=>setP({...p,[k]:e.target.checked})}/> {labels[i]}</label>)}
 <button style={{padding:12,marginTop:12,background:"#e5c78c",color:"#112939"}}>Submit protocol preflight</button></form>{result&&<p role="status">{result}</p>}</section>;
}
