"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import AccountStatus from "./AccountStatus";
import ArtifactIntake from "./ArtifactIntake";
import UploadResearch from "./UploadResearch";
import ResearchInvestigations from "./ResearchInvestigations";
import EvidencePicker from "./EvidencePicker";
import ProtocolReview from "./ProtocolReview";
import ExperimentRegistry from "./ExperimentRegistry";
import OpportunityCoach from "./OpportunityCoach";
import {researchDocket} from "../../lib/agents/network";
import {assessDiscovery} from "../../lib/agents/discovery-validation";
type Agent={id:string;name:string;purpose:string;state:string};
type Data={external:{share:number;connected:number;agents:Agent[]};internal:{share:number;agents:Agent[]};policy:{controls:string[]}};
export default function AgentNetwork(){
 const [data,setData]=useState<Data|null>(null);
 const [ledgerStatus,setLedgerStatus]=useState("checking");
 const [researchStorage,setResearchStorage]=useState<{status?:string;artifactsRegistered?:number|null;registeredBytes?:number|null;uploadsEnabled?:boolean}|null>(null);
 const [ledgerParts,setLedgerParts]=useState<{hypothesisLedger?:boolean;investigationLedger?:boolean;eventsLedger?:boolean}>({});
 const [error,setError]=useState("");
 const [inboxFilter,setInboxFilter]=useState<"all"|"unverified"|"shortlisted"|"rejected">("all");
 const [inboxSearch,setInboxSearch]=useState("");
 const [symbol,setSymbol]=useState("NVDA");
 const [ticker,setTicker]=useState("NVDA");
 const [alignment,setAlignment]=useState<any>(null);
 const [loading,setLoading]=useState(false);
 const [idea,setIdea]=useState("");const [source,setSource]=useState("");const [inbox,setInbox]=useState<Array<{id:string;idea:string;source:string;createdAt:string;reviewStatus?:"unverified"|"shortlisted"|"rejected"}>>([]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("tradeos-agent-inbox-v1")??"[]");if(Array.isArray(saved))setInbox(saved.slice(0,30));}catch{}},[]);
 useEffect(()=>{fetch("/api/research-storage-status",{cache:"no-store"}).then(r=>r.json()).then(setResearchStorage).catch(()=>setResearchStorage({status:"unavailable"}));},[]);
 useEffect(()=>{fetch("/api/agent-ledger-health",{cache:"no-store"}).then(r=>r.json()).then(d=>{setLedgerStatus(String(d.status??"unavailable"));setLedgerParts(d)}).catch(()=>setLedgerStatus("unavailable"));},[]);
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
 <nav style={{display:"flex",gap:25}}><Link href="/" style={{color:"#e8c98a"}}>← TradeOS</Link><Link href="/live-board" style={{color:"#8cdbec"}}>Live Board</Link><AccountStatus/></nav>
 <header style={{maxWidth:850,margin:"38px 0"}}><small style={{color:"#dcc17d",letterSpacing:3}}>TRADEOS AGENT INTELLIGENCE NETWORK</small><h1 style={{fontSize:"clamp(30px,5vw,58px)",margin:"12px 0"}}>Two networks. One research standard.</h1><p style={{lineHeight:1.6,color:"#adc2d0"}}>A 50/50 research foundation: untrusted external discovery and independently governed private analysis.</p></header>
 {error&&<p role="alert">{error}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18}}>
 {(["external","internal"] as const).map(kind=><section key={kind} style={{padding:24,border:"1px solid #a88a56",borderRadius:18,background:"linear-gradient(#102536,#0c1523)"}}>
 <span style={{fontSize:36,fontWeight:900,color:"#e9c781"}}>50%</span><h2>{kind==="external"?"External Intelligence":"Internal Research Council"}</h2>
 <p style={{fontSize:13,color:"#acc3d0"}}>{kind==="external"?"Public agent ecosystem · discovery catalog only":"Private research roles · evidence review only"}</p>
 {(data?.[kind].agents??[]).map(a=><article key={a.id} style={{padding:"14px 0",borderTop:"1px solid #ffffff18"}}><b>{a.name}</b><small style={{display:"block",color:"#73cce3",marginTop:5}}>{a.state.replaceAll("_"," ")}</small><p style={{fontSize:13,lineHeight:1.5,color:"#b9cbd6"}}>{a.purpose}</p></article>)}
 </section>)}</div>
 <section style={{marginTop:24,padding:24,border:"1px solid #b8975e",borderRadius:16,background:"#102436"}}>
 <h2>External Discovery Inbox</h2><p>Capture an externally discovered hypothesis with a public source. Entries stay in this browser, remain unverified, and cannot influence trading models.</p>
 <form onSubmit={e=>{e.preventDefault();let u:URL;try{u=new URL(source);}catch{setError("Provide a valid HTTPS research source");return;}if(u.protocol!=="https:"||!idea.trim()){setError("Provide a hypothesis and an HTTPS source");return;}const review=assessDiscovery({hypothesis:idea,sourceUrl:u.toString(),discoveredAt:new Date().toISOString(),origin:"manual"});if(!review.accepted){setError("Source rejected: "+review.flags.join(", "));return;}if(inbox.some(x=>x.idea.trim().toLowerCase()===idea.trim().toLowerCase()&&x.source===u.toString())){setError("This exact hypothesis and source are already in your inbox.");return;}const next=[{id:crypto.randomUUID(),idea:idea.trim().slice(0,500),source:u.toString().slice(0,600),createdAt:new Date().toISOString(),reviewStatus:"unverified" as const},...inbox].slice(0,30);setInbox(next);try{localStorage.setItem("tradeos-agent-inbox-v1",JSON.stringify(next))}catch{}setIdea("");setSource("");setError("")}}>
 <label htmlFor="agent-hypothesis">Research hypothesis</label><textarea id="agent-hypothesis" value={idea} onChange={e=>setIdea(e.target.value)} maxLength={500} rows={3} style={{display:"block",width:"100%",padding:10,margin:"10px 0",background:"#0b1e2e",color:"#fff",border:"1px solid #6e8899",borderRadius:8}}/>
 <label htmlFor="agent-source">Original public HTTPS source</label><input id="agent-source" type="url" required value={source} onChange={e=>setSource(e.target.value)} style={{display:"block",width:"100%",padding:10,margin:"10px 0",background:"#0b1e2e",color:"#fff",border:"1px solid #6e8899",borderRadius:8}}/>
 <button style={{padding:12,background:"#e9c781",color:"#061522",border:0,borderRadius:8,fontWeight:700}}>Register unverified hypothesis</button></form>
 <p>{inbox.length} locally registered hypotheses · {inbox.filter(x=>x.reviewStatus==="shortlisted").length} shortlisted for human review · 0 independently validated</p><p style={{fontSize:12,color:"#9bb8cb"}}>Research capacity: {Math.max(0,30-inbox.length)} of 30 local entries available. Shortlisting identifies investigation priority, not predictive validity.</p>
 <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"10px 0"}}>
 {(["all","unverified","shortlisted","rejected"] as const).map(state=><button type="button" key={state} onClick={()=>setInboxFilter(state)} aria-pressed={inboxFilter===state} style={{padding:"8px 12px",background:inboxFilter===state?"#d6b878":"#183349",color:inboxFilter===state?"#081320":"#e9f1f5",border:"1px solid #b89e6b",borderRadius:8}}>{state.toUpperCase()} ({state==="all"?inbox.length:inbox.filter(x=>(x.reviewStatus??"unverified")===state).length})</button>)}
 </div>
 <button type="button" disabled={!inbox.length} onClick={()=>{const blob=new Blob([JSON.stringify({schema:"tradeos.discovery.v1",exportedAt:new Date().toISOString(),status:"unverified",records:inbox},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="tradeos-research-inbox.json";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}} style={{padding:10,marginBottom:8,background:"#24485d",color:"#fff",border:"1px solid #7092a2",borderRadius:8}}>Export research inbox (JSON)</button>
 <label style={{display:"block",margin:"12px 0",fontSize:13}}>Restore a previous TradeOS research export (JSON)
 <input type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>200000){setError("Export exceeds the 200 KB import limit");return;}try{const parsed=JSON.parse(await file.text());if(parsed?.schema!=="tradeos.discovery.v1"||!Array.isArray(parsed.records))throw Error("Unrecognized TradeOS export");const valid=parsed.records.slice(0,30).filter((x:any)=>typeof x.idea==="string"&&x.idea.length<=500&&typeof x.source==="string"&&x.source.length<=600&&/^https:\/\//.test(x.source)).map((x:any)=>({id:crypto.randomUUID(),idea:x.idea,source:x.source,createdAt:typeof x.createdAt==="string"&&!Number.isNaN(Date.parse(x.createdAt))?x.createdAt:new Date().toISOString()}));const next=[...valid,...inbox].filter((x,i,a)=>a.findIndex(y=>y.idea===x.idea&&y.source===x.source)===i).slice(0,30);setInbox(next);localStorage.setItem("tradeos-agent-inbox-v1",JSON.stringify(next));setError("");}catch{setError("Import failed: invalid or unsupported research export.");}}} style={{display:"block",marginTop:7}}/></label>
 <label htmlFor="inbox-search">Search research inbox</label><input id="inbox-search" type="search" value={inboxSearch} onChange={e=>setInboxSearch(e.target.value)} placeholder="Hypothesis or source" style={{display:"block",width:"100%",padding:11,margin:"8px 0 16px",background:"#0b1e2e",color:"#fff",border:"1px solid #718b9a",borderRadius:8}}/>
 {inbox.filter(x=>(inboxFilter==="all"||(x.reviewStatus??"unverified")===inboxFilter)&&(!inboxSearch.trim()||(x.idea+" "+x.source).toLowerCase().includes(inboxSearch.trim().toLowerCase()))).map(x=><article key={x.id} style={{padding:12,marginTop:10,border:"1px solid #ffffff22",borderRadius:10,overflowWrap:"anywhere"}}><strong>{(x.reviewStatus??"unverified").toUpperCase()} · {new Date(x.createdAt).toLocaleString()}</strong><p>{x.idea}</p><a href={x.source} target="_blank" rel="noopener noreferrer" style={{color:"#8bdfed"}}>Original source ↗</a><select aria-label="Review triage status" value={x.reviewStatus??"unverified"} onChange={e=>{const status=e.target.value as "unverified"|"shortlisted"|"rejected";const next=inbox.map(y=>y.id===x.id?{...y,reviewStatus:status}:y);setInbox(next);try{localStorage.setItem("tradeos-agent-inbox-v1",JSON.stringify(next))}catch{}}} style={{marginLeft:12,padding:6,background:"#0b1e2e",color:"#e9f1f5"}}><option value="unverified">Unverified</option><option value="shortlisted">Shortlisted for review</option><option value="rejected">Rejected</option></select><button onClick={()=>{const next=inbox.filter(y=>y.id!==x.id);setInbox(next);try{localStorage.setItem("tradeos-agent-inbox-v1",JSON.stringify(next))}catch{}}} style={{marginLeft:15,padding:7}}>Remove</button></article>)}
 </section>
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
 <section style={{marginTop:24,padding:24,border:"1px solid #6c93a7",borderRadius:16}}><h2>Research Storage</h2><p>Storage status: <strong>{researchStorage?.status?.replaceAll("_"," ")??"Checking"}</strong> · Registered artifacts: <strong>{researchStorage?.artifactsRegistered??"Not available"}</strong> · Recorded data: <strong>{typeof researchStorage?.registeredBytes==="number"?(researchStorage.registeredBytes/1024/1024).toFixed(2)+" MiB":"Not available"}</strong></p><p>Neon private bucket configuration and PostgreSQL artifact metadata are tracked separately. Recorded size excludes unregistered object files and does not represent provider billing.</p><p style={{color:"#e8c87e"}}>File transfers: {researchStorage?.uploadsEnabled?"Enabled":"Disabled pending authenticated gateway"}</p><a style={{color:"#e8c87e"}} href="/api/research-storage-status" target="_blank" rel="noopener noreferrer">Check live storage connection and metadata status ↗</a></section>
 <ArtifactIntake/><UploadResearch/><ResearchInvestigations/><EvidencePicker/><ProtocolReview/><ExperimentRegistry/><OpportunityCoach/>
 <section style={{marginTop:24,padding:24,border:"1px solid #6c93a7",borderRadius:16}}><h2>Safety and certification</h2><p>Persistent ledger schema: <strong>{ledgerStatus.replaceAll("_"," ")}</strong> · Anonymous database changes disabled.</p><p style={{color:"#9ad5e4"}}>Hypotheses: {ledgerParts.hypothesisLedger?"Ready":"Not verified"} · Investigations: {ledgerParts.investigationLedger?"Ready":"Not verified"} · Audit events: {ledgerParts.eventsLedger?"Ready":"Not verified"}</p><p>Database availability does not grant access. Browser research remains local until authenticated storage is implemented.</p><p>No external agent accounts are connected yet; agent profiles are controlled development roles.</p>{(data?.policy.controls??[]).map(x=><p key={x}>✓ {x}</p>)}</section>
 </main>;
}
