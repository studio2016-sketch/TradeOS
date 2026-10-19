"use client";
import {useEffect,useState} from "react";
type Investigation={id:string;title:string;hypothesis:string;state:string;created_at:string};
export default function ResearchInvestigations(){
 const [items,setItems]=useState<Investigation[]>([]),[title,setTitle]=useState(""),[hypothesis,setHypothesis]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  try{const r=await fetch("/api/research-investigations",{cache:"no-store"});if(!r.ok)throw Error("Sign in as the verified owner to view persistent research");const b=await r.json();setItems(b.investigations??[]);}catch(e){setStatus(e instanceof Error?e.message:"Unable to load investigations");}
 }
 useEffect(()=>{void load()},[]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setStatus("Saving investigation…");
  try{const r=await fetch("/api/research-investigations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,hypothesis})});const b=await r.json();if(!r.ok)throw Error(b.error||"Save failed");setTitle("");setHypothesis("");setStatus("Saved as UNVERIFIED. No predictive validity or research certification is implied.");await load();}catch(e){setStatus(e instanceof Error?e.message:"Save failed");}finally{setBusy(false);}
 }
 return <section style={{marginTop:24,padding:22,border:"1px solid #c4a56e",borderRadius:16,background:"#0b2230"}}>
 <h2>Persistent Research Investigations</h2><p>Owner-controlled hypotheses stored in Neon. Each entry begins unverified and cannot influence a certified trading model merely because it was saved.</p>
 <form onSubmit={e=>void create(e)}><label>Investigation title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} style={{display:"block",width:"100%",padding:12,margin:"9px 0",color:"#132838"}}/></label>
 <label>Testable hypothesis<textarea required maxLength={2500} value={hypothesis} onChange={e=>setHypothesis(e.target.value)} rows={4} style={{display:"block",width:"100%",padding:12,margin:"9px 0",color:"#132838"}}/></label>
 <button disabled={busy} style={{padding:12,borderRadius:8,background:"#e1c58d",color:"#122636",fontWeight:700}}>Register unverified investigation</button></form>
 {status&&<p role="status">{status}</p>}
 <p>{items.length} persistent investigations</p>
 {items.map(x=><article key={x.id} style={{marginTop:12,border:"1px solid #49667c",padding:14,borderRadius:10}}><strong>{x.title}</strong><p>{x.hypothesis}</p><small>{x.state.toUpperCase()} · {new Date(x.created_at).toLocaleString()}</small></article>)}
 </section>;
}
