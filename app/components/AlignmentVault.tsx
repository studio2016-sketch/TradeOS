"use client";
import {useMemo} from "react";
type Group={group:string;buyScore?:number|null;availability?:number|null};
type Alignment={symbol?:string;buyScore?:number|null;buyState?:string;groups?:Group[];criticalPassed?:number;criticalTotal?:number;canonical?:{all120Aligned?:boolean};decisionCouncil?:{vetoes?:unknown[]}};
const slots=[[-12,-145],[108,-109],[146,-26],[125,76],[54,139],[-57,139],[-130,76],[-147,-26],[-109,-108],[0,-175]];
const clamp=(v:number)=>Math.min(100,Math.max(0,v));
export default function AlignmentVault({symbol,data,onExpand}:{symbol:string;data:Alignment|null;onExpand?:()=>void}){
 const groups=useMemo(()=>((data?.groups??[]).filter(x=>x&&x.group).slice(0,10)),[data]);
 const score=typeof data?.buyScore==="number"&&Number.isFinite(data.buyScore)?clamp(data.buyScore):null;
 const hardVeto=Boolean(data?.decisionCouncil?.vetoes?.length);
 const state=data?.buyState??"UNAVAILABLE";
 const eligible=Boolean(data?.canonical?.all120Aligned)&&state==="MUST BUY"&&!hardVeto;
 const stage=eligible?"UNLOCKED":state==="NO TRADE"?"PASS":state==="WATCH"?"WATCH":state==="READY"||state==="HIGH CONVICTION"?"PREPARE":"WAIT";
 const valid=score!==null&&groups.length>0;
 return <section className="av-shell" aria-label="TradeOS animated trade alignment engine">
  <header className="av-heading"><div><span className="av-eyebrow">TRADEOS PRECISION MOVEMENT · PAPER RESEARCH</span><h2>Trade alignment vault</h2><p>Measured category alignment powers the gears. Verified, risk-approved conditions control the lock.</p></div><span className="av-stamp">No live orders · Not a probability</span></header>
  <div className="av-layout">
   <div className={"av-engine "+(eligible?"av-unlocked":"")} aria-label={symbol+" alignment visualization"}>
    <div className="av-outer"/>
    <div className="av-tickring"/>
    <div className="av-brass"/>
    <div className="av-rotor av-rotor-one"/><div className="av-rotor av-rotor-two"/>
    {Array.from({length:24},(_,i)=><span key={i} className="av-rivet" style={{transform:`rotate(${i*15}deg) translateY(-189px)`}} />)}
    {groups.map((g,i)=>{
      const x=slots[i]?.[0]??0,y=slots[i]?.[1]??0;
      const n=typeof g.buyScore==="number"&&Number.isFinite(g.buyScore)?clamp(g.buyScore):null;
      const color=n===null?"unknown":n>=80?"high":n>=60?"mid":"low";
      return <div key={g.group+i} className={"av-gear av-"+color} style={{left:`calc(50% + ${x}px)`,top:`calc(50% + ${y}px)`}} title={g.group+": "+(n===null?"not available":Math.round(n)+"/100")}>
       <div className="av-gear-teeth"/><div className="av-gear-face"><span>{g.group}</span><b>{n===null?"—":Math.round(n)}</b></div>
      </div>;
    })}
    <div className="av-hub"><span className="av-hub-symbol">{symbol}</span><strong>{score===null?"—":Math.round(score)}<small> / 100</small></strong><em>ALIGNMENT SCORE</em><span className="av-hub-stage">{stage}</span></div>
    <div className="av-door"><div className="av-door-ribs"/><div className="av-door-lock">✦</div></div>
   </div>
   <aside className="av-panel"><span className="av-eyebrow">CURRENT RESEARCH DECISION</span><h3>{symbol}</h3><div className={"av-state av-state-"+stage.toLowerCase()}>{stage}</div><p>{eligible?"All canonical alignment conditions are reported met; independently confirm the full safety gate before any paper-trade action.":!valid?"Awaiting scored group evidence. This vault stays locked.":hardVeto?"Decision Council objections are active. The vault remains locked.":"Gear movement indicates observed alignment only. A strong score never bypasses hard risk, source or certification gates."}</p>
    <div className="av-statgrid"><div><span>Measured score</span><b>{score===null?"Unavailable":Math.round(score)+"/100"}</b></div><div><span>Groups reported</span><b>{groups.length}</b></div><div><span>Critical checks</span><b>{data?.criticalTotal?String(data.criticalPassed??0)+"/"+String(data.criticalTotal):"Unavailable"}</b></div><div><span>Vault</span><b>{eligible?"Open":"Locked"}</b></div></div>
    <div className="av-stage-track">{["PASS","WATCH","PREPARE","UNLOCKED"].map(s=><span key={s} className={stage===s?"selected":""}>{s}</span>)}</div>
    <small className="av-clarifier">Animation responds to the existing alignment API, not decorative sample scores. Source verification and risk authorization remain separate checks.</small>
    {onExpand&&<button className="av-action" onClick={onExpand}>Inspect all 120 gears →</button>}
   </aside>
  </div>
 </section>;
}
