"use client";
import {useState} from "react";
type Fingerprint={name:string;bytes:number;sha256:string;status:string};
const types=new Set(["text/csv","text/plain","application/json","application/pdf","application/octet-stream","application/vnd.apache.parquet"]);
const max=25*1024*1024;
export default function ArtifactIntake(){
 const [items,setItems]=useState<Fingerprint[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 function exportManifest(){
  if(!items.length)return;
  const manifest={schema:"tradeos.artifact-preflight.v1",generatedAt:new Date().toISOString(),authoritative:false,files:items.map(({name,bytes,sha256,status})=>({name,bytes,sha256,status}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="tradeos-artifact-preflight.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function inspect(file:File|undefined){
  if(!file)return;setBusy(true);setError("");
  try{
   if(file.size<1||file.size>max)throw Error("Select a file between 1 byte and 25 MiB.");
   if(!types.has(file.type||"application/octet-stream"))throw Error("Unsupported research format.");
   const bytes=await file.arrayBuffer();
   const raw=await crypto.subtle.digest("SHA-256",bytes);
   const sha256=Array.from(new Uint8Array(raw)).map(x=>x.toString(16).padStart(2,"0")).join("");
   setItems(previous=>[{name:file.name,bytes:file.size,sha256,status:previous.some(x=>x.sha256===sha256)?"Duplicate content detected":"Local fingerprint ready"},...previous].slice(0,12));
  }catch(e){setError(e instanceof Error?e.message:"Unable to inspect file.");}finally{setBusy(false);}
 }
 return <section style={{marginTop:22,padding:22,border:"1px solid #7895a4",borderRadius:16,background:"#0b2230"}}>
 <h2>Research Artifact Intake</h2><p style={{lineHeight:1.6}}>Inspect a local research dataset and calculate its SHA-256 fingerprint before registration. This is a <strong>local-only preflight</strong>: no file bytes leave your browser, and no Neon upload occurs.</p>
 <label style={{display:"block",padding:12,border:"1px dashed #bca06d",borderRadius:9}}>Select CSV, JSON, PDF, plain text or Parquet (25 MiB maximum)
 <input type="file" accept=".csv,.json,.pdf,.txt,.parquet" disabled={busy} onChange={e=>{void inspect(e.target.files?.[0]);e.target.value="";}} style={{display:"block",marginTop:10,maxWidth:"100%"}}/></label>
 {busy&&<p role="status">Calculating fingerprint locally…</p>}{error&&<p role="alert" style={{color:"#ffb6b6"}}>{error}</p>}
 {items.length>0&&<button type="button" onClick={exportManifest} style={{marginTop:12,padding:10,background:"#d8bb81",color:"#142638",border:0,borderRadius:8,fontWeight:700}}>Export local fingerprint manifest (JSON)</button>}
 {items.map((item,i)=><div key={item.sha256+"-"+i} style={{padding:12,marginTop:10,border:"1px solid #50687c",borderRadius:10,overflowWrap:"anywhere"}}><strong>{item.name}</strong> · {item.bytes.toLocaleString()} bytes<p style={{color:item.status.startsWith("Duplicate")?"#f6c080":"#a8e7c1"}}>{item.status}</p><code style={{fontSize:12}}>{item.sha256}</code></div>)}
 <p style={{color:"#b9c8d1",fontSize:13}}>Export contains filenames and fingerprints, never file contents. Fingerprint matches are preliminary and not authoritative until a server independently verifies the uploaded bytes. Authenticated transfer remains disabled while storage signing is configured.</p></section>;
}
