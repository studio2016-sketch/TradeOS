"use client";
import {useState} from "react";
import {traceTransmission,transmissionLibrary} from "../../lib/research/market-impact";
export default function MarketImpactExplorer(){
 const [driver,setDriver]=useState("energy_supply_disruption");
 const result=traceTransmission(driver,3);
 return <section style={{marginTop:22,padding:22,border:"1px solid #d3ad66",borderRadius:14,background:"#102a37"}}>
 <h2>Global Market Impact Explorer</h2><p>Explore possible chains from an economic event to market-sensitive outcomes. These are <strong>conditional research hypotheses</strong>, not current news, verified predictions, or trade recommendations.</p>
 <label>Economic development<select value={driver} onChange={e=>setDriver(e.target.value)} style={{display:"block",padding:12,color:"#142639",width:"100%"}}>{[...new Set(transmissionLibrary.map(x=>x.cause))].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label>
 {result.paths.map((p,i)=><article key={i} style={{marginTop:12,padding:14,border:"1px solid #4b6c7c",borderRadius:10}}>
 <strong>{p.nodes.map(n=>n.replaceAll("_"," ")).join(" → ")}</strong>
 {p.edges.map((e,j)=><p key={j} style={{fontSize:13}}>{e.direction.toUpperCase()} · {e.delay} · {e.mechanism}. Dependencies: {e.conditions.join(", ")}</p>)}
 </article>)}
 <p style={{fontSize:13,color:"#aec6ce"}}>{result.warning}</p>
 </section>;
}
