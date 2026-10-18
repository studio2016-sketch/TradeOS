"use client";
import {useEffect,useState} from "react";
type GraphResponse={status:string;nodes:{id:string;kind:string;label:string}[];edges:{from:string;to:string;relation:string;source:string;observedAt:string|null;status:string}[];corporateStatus?:string;corporateRelationships?:{id:string;from:string;to:string;relation:string;sourceName:string;sourceUrl:string;publishedAt:string;verificationStatus:string}[];metadata?:{undatedEdges:number;evidenceRows:number}};
export default function FinancialKnowledgeGraph(){
 const [ticker,setTicker]=useState("NVDA"),[data,setData]=useState<GraphResponse|null>(null),[cert,setCert]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(symbol=ticker){
  setBusy(true);setError("");
  try{
   const [g,c]=await Promise.all([fetch("/api/knowledge-graph?symbol="+encodeURIComponent(symbol),{cache:"no-store"}),fetch("/api/research-certification",{cache:"no-store"})]);
   if(!g.ok||!c.ok)throw Error("A research evidence source is unavailable.");
   setData(await g.json());setCert(await c.json());
  }catch(e){setError(e instanceof Error?e.message:"Unavailable")}finally{setBusy(false)}
 }
 useEffect(()=>{refresh("NVDA")},[]);
 const corporate=data?.corporateRelationships??[];
 return <main style={{maxWidth:1120,margin:"auto",padding:"32px 22px",background:"#0b1f2b",color:"#e5f2f0",fontFamily:"system-ui",minHeight:"100vh"}}>
  <a href="/" style={{color:"#8fded3"}}>← TradeOS</a><h1>Financial Knowledge Graph</h1>
  <p>Trace observed stocks, research models, factors and sources. Corporate relationships appear only when supported by dated evidence; the system does not invent suppliers, customers or market exposures.</p>
  <label>Stock symbol <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={10} style={{margin:"0 12px",padding:9,color:"#102433"}}/></label><button onClick={()=>refresh()} disabled={busy} style={{padding:10}}>{busy?"Checking…":"Explore evidence"}</button>
  {error&&<p role="alert">{error}</p>}
  <section style={{marginTop:24,padding:20,border:"1px solid #436172",borderRadius:12}}><h2>Independent Research Certification Authority</h2>
   <p><b>Status: {cert?.status??"UNAVAILABLE"}</b> · Model promotion: {cert?.modelPromotionAllowed?"Allowed":"BLOCKED"} · Live execution: {cert?.liveExecutionAllowed?"Allowed":"BLOCKED"}</p>
   <p>{cert?.note??"Certification evidence not retrieved."}</p>{cert?.checks?.map((c:any)=><p key={c.id}>{c.pass?"✓":"✕"} {c.detail}</p>)}
  </section>
  <section style={{marginTop:24,padding:20,border:"1px solid #436172",borderRadius:12}}><h2>Observed research network</h2>
   <p>Research records: {data?.metadata?.evidenceRows??"Unavailable"} · Nodes: {data?.nodes?.length??"Unavailable"} · Edges: {data?.edges?.length??"Unavailable"} · Undated edges: {data?.metadata?.undatedEdges??"Unavailable"}</p>
   {data?.nodes?.filter(n=>n.kind==="factor").map(n=><p key={n.id}><strong>{n.label}</strong> — recorded factor, not independently validated</p>)}
   {!data?.nodes?.length&&<p>There are no qualifying stored research relationships for this security.</p>}
  </section>
  <section style={{marginTop:24,padding:20,border:"1px solid #436172",borderRadius:12}}><h2>Verified business and economic relationships</h2>
   <p>Relationship database: {data?.corporateStatus??"UNAVAILABLE"} · Sourced relationships: {corporate.length}</p>
   {corporate.map(x=><p key={x.id}><b>{x.from}</b> {x.relation} <b>{x.to}</b> · {x.verificationStatus} · Published {new Date(x.publishedAt).toLocaleDateString()} · <a href={x.sourceUrl} style={{color:"#95dccd"}} rel="noopener noreferrer" target="_blank">{x.sourceName}</a></p>)}
   {!corporate.length&&<p>No independently sourced business relationship is established by this dataset. No speculative links are displayed.</p>}
  </section><p style={{fontSize:13,color:"#b0c1ca"}}>This graph is research infrastructure, not a probability engine or live trading authorization.</p>
 </main>;
}
