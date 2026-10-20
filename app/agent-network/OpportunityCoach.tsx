"use client";
import {useState} from "react";
const fields=["evidence","regime","trend","relativeStrength","riskReward","liquidity","council"] as const;
export default function OpportunityCoach(){
 const [symbol,setSymbol]=useState(""),[scores,setScores]=useState<Record<string,number>>(Object.fromEntries(fields.map(k=>[k,50]))),[result,setResult]=useState(""),[busy,setBusy]=useState(false);
 async function evaluate(){setBusy(true);try{
  const response=await fetch("/api/opportunity-assessment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:symbol.toUpperCase().trim(),asOf:new Date().toISOString(),dataFresh:false,tradable:false,spreadBps:999,...scores})});
  const out=await response.json();setResult(JSON.stringify(out,null,2));
 }catch(e){setResult(e instanceof Error?e.message:"Assessment unavailable");}finally{setBusy(false);}}
 return <section style={{padding:20,marginTop:20,background:"#112b38",border:"1px solid #b9a06a",borderRadius:14}}>
 <h2>Trade Decision Coach · Research Sandbox</h2><p>Learn the decision criteria without fabricated live market assessments. Until independently verified market feeds populate all mandatory gates, the engine correctly returns NO TRADE.</p>
 <label>Symbol<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="Example: SPY" style={{display:"block",padding:10,width:"100%"}}/></label>
 {fields.map(k=><label key={k} style={{display:"block",marginTop:12}}>{k} — {scores[k]}/100<input type="range" min="0" max="100" value={scores[k]} onChange={e=>setScores({...scores,[k]:Number(e.target.value)})} style={{display:"block",width:"100%"}}/></label>)}
 <button type="button" disabled={busy||!symbol.trim()} onClick={()=>void evaluate()} style={{padding:12,marginTop:14,background:"#e6c990",color:"#122b37",borderRadius:8}}>Explain simulated assessment</button>
 {result&&<pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{result}</pre>}
 </section>;
}
