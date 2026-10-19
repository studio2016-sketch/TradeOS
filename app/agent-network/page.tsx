"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {researchDocket} from "../../lib/agents/network";
type Agent={id:string;name:string;purpose:string;state:string};
type Data={external:{share:number;connected:number;agents:Agent[]};internal:{share:number;agents:Agent[]};policy:{controls:string[]}};
export default function AgentNetwork(){
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 const [symbol,setSymbol]=useState("NVDA");
 const [ticker,setTicker]=useState("NVDA");
 const [alignment,setAlignment]=useState<any>(null);
 const [loading,setLoading]=useState(false);
 useEffect(()=>{fetch("/api/agent-network",{cache:"no-store"}).then(r=>r.json()).then(setData).catch(()=>setError("Agent registry unavailable"));},[]);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  setAlignment(null);setLoading(true);
  fetch("/api/alignment?symbol="+encodeURIComponent(symbol),{cache:"no-store",signal:controller.signal})
   .then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.symbol===symbol)setAlignment(d);})
   .catch(()=>{}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[symbol]);
 const docket=researchDocket({symbol,readings:alignment?.readings,generatedAt:alignment?.generatedAt});
 return <main style={{minHeight:"100vh",background:"#081320",color:"#e9f1f5",padding:"clamp(16px,4vw,48px)",fontFamily:"system-ui"}}>
 <nav style={{display:"flex",gap:25}}><Link href="/" style={{color:"#e8c98a"}}>← TradeOS</Link><Link href="/live-board" style={{color:"#8cdbec"}}>Live Board</Link></nav>
 <header style={{maxWidth:850,margin:"38px 0"}}><small style={{color:"#dcc17d",letterSpacing:3}}>TRADEOS AGENT INTELLIGENCE NETWORK</small><h1 style={{fontSize:"clamp(30px,5vw,58px)",margin:"12px 0"}}>Two networks. One research standard.</h1><p style={{lineHeight:1.6,color:"#adc2d0"}}>A 50/50 research foundation: untrusted external discovery and independently governed private analysis.</p></header>
 {error&&<p role="alert">{error}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18}}>
 {(["external","internal"] as const).map(kind=><section key={kind} style={{padding:24,border:"1px solid #a88a56",borderRadius:18,background:"linear-gradient(#102536,#0c1523)"}}>
 <span style={{fontSize:36,fontWeight:900,color:"#e9c781"}}>50%</span><h2>{kind==="external"?"External Intelligence":"Internal Research Council"}</h2>
 <p style={{fontSize:13,color:"#acc3d0"}}>{kind==="external"?"Public agent ecosystem · discovery catalog only":"Private research roles · evidence review only"}</p>
 {(data?.[kind].agents??[]).map(a=><article key={a.id} style={{padding:"14px 0",borderTop:"1px solid #ffffff18"}}><b>{a.name}</b><small style={{display:"block",color:"#73cce3",marginTop:5}}>{a.state.replaceAll("_"," ")}</small><p style={{fontSize:13,lineHeight:1.5,color:"#b9cbd6"}}>{a.purpose}</p></article>)}
 </section>)}</div>
 <section style={{marginTop:24,padding:24,border:"1px solid #6c93a7",borderRadius:16}}>
 <h2>Evidence-driven Council Preview</h2><p>This view organizes existing TradeOS evidence by research role. These are not autonomous agents or certified independent conclusions.</p>
 <form onSubmit={e=>{e.preventDefault();const x=ticker.trim().toUpperCase();if(/^[A-Z][A-Z0-9.-]{0,9}$/.test(x)){setError("");setSymbol(x)}else setError("Invalid ticker")}}>
 <label htmlFor="research-symbol">Stock symbol </label>
 <input id="research-symbol" value={ticker} onChange={e=>setTicker(e.target.value)} maxLength={10} style={{padding:10,margin:9,background:"#10283b",border:"1px solid #7191a2",borderRadius:8,color:"#fff"}}/>
 <button style={{background:"#e9c781",color:"#061522",padding:11,border:0,borderRadius:8,fontWeight:700}}>Review evidence</button></form>
 <p aria-live="polite">{loading?"Loading research readings…":alignment?String(alignment.observedCount??0)+" market factors observed for "+symbol:"Research measurements unavailable for "+symbol}</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:12}}>
 {docket.investigations.map(item=><article key={item.agent} style={{background:"#132c40",padding:16,borderRadius:12,border:"1px solid #43647b"}}>
 <strong>{item.agent.replaceAll("-"," ").toUpperCase()}</strong><p style={{fontSize:12,color:"#a9c1d0",lineHeight:1.6}}>{item.claim}</p>
 {item.evidence.map((ev,i)=><p key={i} style={{fontSize:12,borderTop:"1px solid #ffffff18",paddingTop:7}}>{ev.factor??"Unspecified"}<br/><small>{ev.source??"Source unavailable"}</small></p>)}
 <small style={{color:"#efcc83"}}>{item.status.replaceAll("_"," ")}</small></article>)}
 </div></section>
 <section style={{marginTop:24,padding:24,border:"1px solid #6c93a7",borderRadius:16}}><h2>Safety and certification</h2><p>No external agent accounts are connected yet; agent profiles are controlled development roles.</p>{(data?.policy.controls??[]).map(x=><p key={x}>✓ {x}</p>)}</section>
 </main>;
}
