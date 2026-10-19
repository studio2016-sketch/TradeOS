"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
type Agent={id:string;name:string;purpose:string;state:string};
type Data={external:{share:number;connected:number;agents:Agent[]};internal:{share:number;agents:Agent[]};policy:{controls:string[]}};
export default function AgentNetwork(){
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/agent-network").then(r=>r.json()).then(setData).catch(()=>setError("Agent catalog unavailable"));},[]);
 return <main style={{minHeight:"100vh",background:"#081320",color:"#e9f1f5",padding:"clamp(16px,4vw,48px)",fontFamily:"system-ui"}}>
 <nav style={{display:"flex",gap:25}}><Link href="/" style={{color:"#e8c98a"}}>← TradeOS</Link><Link href="/live-board" style={{color:"#8cdbec"}}>Live Board</Link></nav>
 <header style={{maxWidth:850,margin:"38px 0"}}><small style={{color:"#dcc17d",letterSpacing:3}}>TRADEOS AGENT INTELLIGENCE NETWORK</small><h1 style={{fontSize:"clamp(30px,5vw,58px)",margin:"12px 0"}}>Two networks. One research standard.</h1><p style={{lineHeight:1.6,color:"#adc2d0"}}>A balanced foundation for public agent discovery and private analytical research. External communities cannot promote models or place orders.</p></header>
 {error&&<p role="alert">{error}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18}}>
 {(["external","internal"] as const).map(kind=><section key={kind} style={{padding:24,border:"1px solid #a88a56",borderRadius:18,background:"linear-gradient(#102536,#0c1523)"}}>
 <span style={{fontSize:36,fontWeight:900,color:"#e9c781"}}>50%</span><h2>{kind==="external"?"External Intelligence":"Internal Research Council"}</h2>
 <p style={{fontSize:13,color:"#acc3d0"}}>{kind==="external"?"Public agent ecosystem · discovery catalog only":"Private research roles · analytical review only"}</p>
 {(data?.[kind].agents??[]).map(a=><article key={a.id} style={{padding:"14px 0",borderTop:"1px solid #ffffff18"}}><b>{a.name}</b><small style={{display:"block",color:"#73cce3",marginTop:5}}>{a.state.replaceAll("_"," ")}</small><p style={{fontSize:13,lineHeight:1.5,color:"#b9cbd6"}}>{a.purpose}</p></article>)}
 </section>)}</div>
 <section style={{marginTop:24,padding:24,border:"1px solid #6c93a7",borderRadius:16}}><h2>Safety and certification</h2><p>No external agent accounts are connected yet; agent profiles represent controlled development roles, not autonomous services currently running.</p>{(data?.policy.controls??[]).map(x=><p key={x}>✓ {x}</p>)}</section>
 </main>;
}
