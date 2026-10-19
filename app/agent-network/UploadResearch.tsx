"use client";
import {useState} from "react";
export default function UploadResearch(){
 const [file,setFile]=useState<File|null>(null);
 const [kind,setKind]=useState("report");
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 async function upload(){
  if(!file)return;setBusy(true);setStatus("Calculating file fingerprint…");
  try{
   if(file.size<1||file.size>25*1024*1024)throw Error("File size must be 1 byte to 25 MiB");
   const mime=file.type||"application/octet-stream";
   const data=await file.arrayBuffer();const digest=await crypto.subtle.digest("SHA-256",data);
   const sha256=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
   setStatus("Requesting short-lived upload permission…");
   const permit=await fetch("/api/research-artifacts/sign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:mime,bytes:file.size,sha256})});
   const signed=await permit.json();if(!permit.ok)throw Error(signed.status||"Upload not authorized");
   setStatus("Uploading into private Neon research storage…");
   const sent=await fetch(signed.url,{method:"PUT",headers:{"Content-Type":mime},body:data});
   if(!sent.ok)throw Error("Storage rejected upload ("+sent.status+"). Check bucket credentials and CORS.");
   setStatus("Independently reading back object and verifying checksum…");
   const verified=await fetch("/api/research-artifacts/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha256,kind,contentType:mime})});
   const result=await verified.json();if(!verified.ok||!result.verified)throw Error(result.error||"Integrity check failed");
   setStatus("Verified and registered in Neon · SHA-256 "+sha256+" · "+result.bytes+" bytes");
  }catch(error){setStatus("Not completed: "+(error instanceof Error?error.message:"Unexpected error"));}
  finally{setBusy(false);}
 }
 return <section style={{marginTop:20,padding:22,border:"1px solid #b7a074",borderRadius:14,background:"#102b37"}}>
 <h2>Private Research Upload</h2><p>Upload a research file only after authenticated owner authorization. TradeOS re-reads the stored bytes, independently checks their SHA-256 digest, then records the verified artifact.</p>
 <label>Research class <select value={kind} onChange={e=>setKind(e.target.value)} style={{marginLeft:12,padding:8,color:"#112536"}}><option value="report">Research report</option><option value="market_bars">Market bars</option><option value="simulation_dataset">Simulation dataset</option></select></label>
 <input type="file" accept=".csv,.json,.txt,.pdf,.parquet" onChange={e=>setFile(e.target.files?.[0]??null)} style={{display:"block",margin:"15px 0",maxWidth:"100%"}}/>
 <button type="button" disabled={!file||busy} onClick={()=>void upload()} style={{padding:"11px 16px",borderRadius:8,border:0,background:"#dac083",fontWeight:700}}>{busy?"Processing…":"Upload and verify"}</button>
 {status&&<p role="status" style={{overflowWrap:"anywhere",lineHeight:1.6}}>{status}</p>}
 <p style={{fontSize:12,color:"#afc5ce"}}>A signed upload is not certified research evidence. Storage provider access and CORS must be validated before this workflow can be declared operational. No brokerage trading is enabled.</p></section>;
}
