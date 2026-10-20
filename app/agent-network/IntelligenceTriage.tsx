"use client";
import {useState} from "react";
import {scoreLead} from "../../lib/research/intelligence-triage";
export default function IntelligenceTriage(){
 const [novelty,setNovelty]=useState(60),[materiality,setMateriality]=useState(70),[quality,setQuality]=useState(70),[relevance,setRelevance]=useState(60),[urgency,setUrgency]=useState(50),[independent,setIndependent]=useState(false),[contradictions,setContradictions]=useState(0);
 const now=new Date().toISOString();
 const result=scoreLead({id:"illustrative",headline:"Illustrative event, not verified news",publishedAt:now,observedAt:now,sourceFamily:"example",otherSourceFamilies:independent?["secondary_example"]:[],symbols:["SPY"],mechanism:"Illustrative valuation channel",novelty,materiality,quality,relevance,urgency,contradictions},now);
 return <section style={{padding:20,marginTop:20,border:"1px solid #cbaa75",borderRadius:14,background:"#102b38"}}>
 <h2>High-Signal Intelligence Filter</h2><p>Research sandbox: demonstrate how source corroboration, relevance, and contradictory evidence determine investigation priority. Inputs are hypothetical, not current market data.</p>
 {([["novelty",novelty,setNovelty],["materiality",materiality,setMateriality],["quality",quality,setQuality],["relevance",relevance,setRelevance],["urgency",urgency,setUrgency]] as const).map(([label,value,set])=><label key={label} style={{display:"block",marginTop:12}}>{label} · {value}/100<input type="range" min="0" max="100" value={value} onChange={e=>set(Number(e.target.value))} style={{width:"100%",display:"block"}}/></label>)}
 <label style={{display:"block",marginTop:12}}><input type="checkbox" checked={independent} onChange={e=>setIndependent(e.target.checked)}/> Independent source family corroboration simulated</label>
 <label style={{display:"block",marginTop:12}}>Contradictory observations: {contradictions}<input type="range" min="0" max="5" value={contradictions} onChange={e=>setContradictions(Number(e.target.value))} style={{width:"100%",display:"block"}}/></label>
 <p><strong>{result.action}</strong> · Score: {result.score??"Not admissible"}</p>
 {result.issues.map(x=><p key={x}>{x}</p>)}<small>Illustrative weights are not calibrated to profitable trade outcomes. No trade signals are authorized.</small></section>;
}
