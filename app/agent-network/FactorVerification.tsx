"use client";
import {useEffect,useState} from "react";

type FactorStatus="UNMEASURED"|"MEASURED_UNVERIFIED"|"ENGINEERING_VERIFIED"|"SOURCE_TIME_VERIFIED"|"FULLY_VERIFIED";
type Factor={key:string;family:string;observations:number;subjects:number;status:FactorStatus;blockers:string[];modelInfluenceAllowed:boolean};
type Response={generatedAt:string;defined:number;counts:{unmeasured:number;measuredUnverified:number;engineeringVerified:number;sourceTimeVerified:number;fullyVerified:number};gates:{implementationVerified:number;measured:number;sourceIdentityVerified:number;sourceTimeCertified:number;modelInfluenceAllowed:number};factors:Factor[];policy:string};

const statusColor:Record<FactorStatus,string>={UNMEASURED:"#f29b9b",MEASURED_UNVERIFIED:"#e8c77b",ENGINEERING_VERIFIED:"#8fd7e0",SOURCE_TIME_VERIFIED:"#8fe0b7",FULLY_VERIFIED:"#70e09b"};

export default function FactorVerification(){
 const [data,setData]=useState<Response|null>(null),[error,setError]=useState("");
 async function refresh(){
  try{const response=await fetch("/api/factor-verification",{cache:"no-store"});if(!response.ok)throw Error(response.status===403?"Verified owner session required":"Factor verification audit unavailable");setData(await response.json());setError("");}
  catch(reason){setData(null);setError(reason instanceof Error?reason.message:"Factor verification audit unavailable");}
 }
 useEffect(()=>{void refresh();},[]);
 const unresolved=data?.factors.filter(f=>f.status!=="FULLY_VERIFIED").sort((a,b)=>a.observations-b.observations||a.key.localeCompare(b.key)).slice(0,18)??[];
 return <section style={{marginTop:24,padding:22,border:"1px solid #6f9c88",borderRadius:14,background:"#102a39"}}>
  <h2>Factor Verification Authority</h2>
  <p>Implementation, measurement, source identity, source timing, and predictive validation are separate fail-closed gates.</p>
  <button type="button" onClick={()=>void refresh()} style={{padding:"10px 15px"}}>Refresh factor verification</button>
  {error?<p role="status">{error}</p>:null}
  {data?<>
   <div style={{fontSize:25,fontWeight:800,margin:"14px 0",color:data.counts.fullyVerified===data.defined?"#70e09b":"#e8c77b"}}>{data.counts.fullyVerified} / {data.defined} fully verified</div>
   <p>{data.gates.implementationVerified} implementations test-linked · {data.gates.measured} measured · {data.gates.sourceIdentityVerified} recognized primary/entitled sources · {data.gates.sourceTimeCertified} prospectively time-certified · {data.gates.modelInfluenceAllowed} eligible for model influence</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(235px,1fr))",gap:9}}>{unresolved.map(f=><article key={f.key} style={{padding:12,border:"1px solid #527083",borderRadius:9}}>
    <strong>{f.key.replaceAll("_"," ")}</strong><div style={{fontSize:12,fontWeight:800,color:statusColor[f.status]}}>{f.status.replaceAll("_"," ")}</div>
    <small>{f.family.replaceAll("_"," ")} · {f.observations} observations · {f.subjects} subjects</small>
    <small style={{display:"block",marginTop:7,color:"#b6c9d5"}}>Next: {(f.blockers[0]??"No remaining gate").replaceAll("_"," ").toLowerCase()}</small>
   </article>)}</div>
   <p style={{fontSize:12,lineHeight:1.6}}>{data.policy} Audited {new Date(data.generatedAt).toLocaleString()}.</p>
  </>:null}
 </section>;
}
