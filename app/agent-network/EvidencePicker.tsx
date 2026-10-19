"use client";
import {useEffect,useState} from "react";
type Investigation={id:string;title:string};
type Artifact={id:string;sha256_hex:string;artifact_kind:string;byte_size:string};
export default function EvidencePicker(){
 const [investigations,setInvestigations]=useState<Investigation[]>([]);
 const [artifacts,setArtifacts]=useState<Artifact[]>([]);
 const [investigation,setInvestigation]=useState("");
 const [sha,setSha]=useState("");
 const [source,setSource]=useState("");
 const [notes,setNotes]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  try{
   const [i,a]=await Promise.all([fetch("/api/research-investigations",{cache:"no-store"}),fetch("/api/research-artifacts/registry",{cache:"no-store"})]);
   if(!i.ok||!a.ok)throw Error("Sign in with your verified owner account to select evidence");
   setInvestigations((await i.json()).investigations??[]);
   setArtifacts((await a.json()).artifacts??[]);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to load research");}
 }
 useEffect(()=>{void refresh()},[]);
 async function attach(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("Linking evidence…");
  try{
   const r=await fetch("/api/research-investigations/evidence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId:investigation,sha256:sha,sourceUrl:source,notes})});
   const b=await r.json();if(!r.ok)throw Error(b.error??"Could not link evidence");
   setMessage("Evidence linked. Scientific validation remains pending.");setSha("");setNotes("");
  }catch(e){setMessage(e instanceof Error?e.message:"Evidence linking failed");}finally{setBusy(false);}
 }
 const field={width:"100%",padding:12,color:"#142535",margin:"8px 0 14px",borderRadius:7};
 return <section style={{marginTop:20,padding:20,border:"1px solid #ad956b",borderRadius:14,background:"#102936"}}>
 <h3>Research Evidence Manager</h3><p>Select a persistent investigation and a registered file. Linking evidence does not constitute scientific certification.</p>
 <button type="button" onClick={()=>void refresh()} style={{padding:9,marginBottom:14}}>Refresh investigations and files</button>
 <form onSubmit={e=>void attach(e)}>
 <label>Investigation<select required value={investigation} onChange={e=>setInvestigation(e.target.value)} style={field}><option value="">Select investigation</option>{investigations.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
 <label>Verified storage artifact<select required value={sha} onChange={e=>setSha(e.target.value)} style={field}><option value="">Select registered file</option>{artifacts.map(x=><option key={x.id} value={x.sha256_hex}>{x.artifact_kind} · {x.byte_size} bytes · {x.sha256_hex.slice(0,12)}</option>)}</select></label>
 <label>Original HTTPS source<input type="url" value={source} onChange={e=>setSource(e.target.value)} placeholder="https://" style={field}/></label>
 <label>Provenance notes<textarea maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)} style={field}/></label>
 <button type="submit" disabled={busy||!investigation||!sha} style={{padding:12,background:"#e0c184",color:"#102635",borderRadius:8}}>Attach unverified evidence</button></form>
 {message&&<p role="status">{message}</p>}
 </section>;
}
