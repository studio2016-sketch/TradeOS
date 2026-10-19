"use client";
import {useState} from "react";
export default function LinkEvidence(){
 const [investigationId,setInvestigationId]=useState(""),[sha256,setSha256]=useState(""),[sourceUrl,setSourceUrl]=useState(""),[notes,setNotes]=useState(""),[message,setMessage]=useState("");
 async function attach(e:React.FormEvent){e.preventDefault();
  try{
   const res=await fetch("/api/research-investigations/evidence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({investigationId,sha256,sourceUrl,notes})});
   const response=await res.json();
   if(!res.ok)throw Error(response.error||"Unable to link evidence");
   setMessage("Linked successfully. Evidence remains unverified.");setSha256("");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to link evidence");}
 }
 return <section style={{padding:20,border:"1px solid #c4a56e",borderRadius:14,marginTop:18}}>
 <h3>Attach Verified Storage Evidence</h3><p>Paste an investigation ID and the 64-character SHA-256 of an artifact already registered in Neon.</p>
 <form onSubmit={e=>void attach(e)}>
 <input placeholder="Investigation UUID" required value={investigationId} onChange={e=>setInvestigationId(e.target.value)} style={{display:"block",width:"100%",padding:10,marginBottom:8}}/>
 <input placeholder="Registered artifact SHA-256" required pattern="[a-fA-F0-9]{64}" value={sha256} onChange={e=>setSha256(e.target.value)} style={{display:"block",width:"100%",padding:10,marginBottom:8}}/>
 <input placeholder="Original HTTPS source URL (optional)" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} style={{display:"block",width:"100%",padding:10,marginBottom:8}}/>
 <textarea placeholder="Provenance notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1500} style={{display:"block",width:"100%",padding:10,marginBottom:8}}/>
 <button style={{padding:10,background:"#e1c58d",color:"#102330"}}>Link unverified evidence</button></form>
 {message&&<p role="status">{message}</p>}</section>;
}
