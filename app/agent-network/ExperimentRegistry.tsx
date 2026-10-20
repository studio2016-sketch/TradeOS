"use client";
import {useEffect,useState} from "react";
type Item={id:string;protocol_sha256:string;registered_at:string;status:string};
export default function ExperimentRegistry(){
 const [investigationId,setInvestigationId]=useState(""),[artifactSha256,setArtifactSha256]=useState(""),[protocol,setProtocol]=useState('{"hypothesis":"","primaryMetric":"","holdoutStart":"","holdoutEnd":"","baseline":"","dataAsOf":""}'),[items,setItems]=useState<Item[]>([]),[message,setMessage]=useState("");
 async function load(){try{const r=await fetch("/api/research-experiments",{cache:"no-store"});if(r.ok)setItems((await r.json()).experiments??[]);}catch{}}
 useEffect(()=>{void load()},[]);
 async function register(e:React.FormEvent){e.preventDefault();try{const parsed=JSON.parse(protocol);const r=await fetch("/api/research-experiments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId,artifactSha256,protocol:parsed})});const b=await r.json();if(!r.ok)throw Error(b.error||"Registration failed");setMessage("Preregistered: "+b.id+" · Not model-certified.");await load();}catch(e){setMessage(e instanceof Error?e.message:"Invalid protocol");}}
 return <section style={{marginTop:20,padding:20,border:"1px solid #c5a773",borderRadius:14,background:"#102a35"}}><h3>Immutable Experiment Preregistration</h3><p>Lock each experiment's data artifact and intended method before examining outcomes. This registry prevents ordinary API overwrites; stronger database-level immutability controls are still required.</p>
 <form onSubmit={e=>void register(e)}>
 <input required placeholder="Investigation UUID" value={investigationId} onChange={e=>setInvestigationId(e.target.value)} style={{display:"block",padding:10,width:"100%",marginBottom:10}}/>
 <input required placeholder="Registered data SHA-256" value={artifactSha256} onChange={e=>setArtifactSha256(e.target.value)} style={{display:"block",padding:10,width:"100%",marginBottom:10}}/>
 <label>Preregistered protocol (JSON)<textarea required rows={5} value={protocol} onChange={e=>setProtocol(e.target.value)} style={{display:"block",padding:10,width:"100%"}}/></label>
 <button style={{padding:12,marginTop:12,color:"#142939",background:"#e6c88c"}}>Preregister experiment</button></form>
 {message&&<p role="status" style={{overflowWrap:"anywhere"}}>{message}</p>}
 <p>{items.length} saved experiments (latest 100)</p>{items.map(x=><p key={x.id} style={{overflowWrap:"anywhere"}}><strong>{x.status}</strong> · {x.id} · {new Date(x.registered_at).toLocaleString()}</p>)}
 </section>;
}
