"use client";
import {useEffect,useState} from "react";
type Bar={time:string;open:number;high:number;low:number;close:number;volume:number};
export default function HistoricalChart({symbol="SPY",replay=false}:{symbol?:string;replay?:boolean}){
 const [state,setState]=useState<any>(null),[visible,setVisible]=useState(25),[busy,setBusy]=useState(false);
 useEffect(()=>{let cancelled=false;setBusy(true);setState(null);fetch("/api/historical-bars?symbol="+encodeURIComponent(symbol),{cache:"no-store"}).then(r=>r.json()).then(d=>{if(!cancelled){setState(d);setVisible(replay?Math.min(15,d.bars?.length||0):d.bars?.length||0)}}).catch(()=>{if(!cancelled)setState({bars:[],message:"Historical provider unreachable"})}).finally(()=>{if(!cancelled)setBusy(false)});return()=>{cancelled=true}},[symbol,replay]);
 const bars:Bar[]=state?.bars||[];const slice=bars.slice(0,Math.max(0,visible));const min=slice.length?Math.min(...slice.map(b=>b.low)):0;const max=slice.length?Math.max(...slice.map(b=>b.high)):1;const y=(price:number)=>15+(max-price)/(max-min||1)*185;const x=(i:number)=>28+i*(570/Math.max(1,slice.length-1));
 return <section style={{background:"#0a1b2b",padding:16,borderRadius:14,border:"1px solid #2e5262",maxWidth:"100%"}}>
 <strong>Historical OHLC · {symbol}</strong><small style={{display:"block",color:"#9cc9c8",margin:"8px 0"}}>{state?.source||"Provider pending"} · {state?.adjustment||"—"} adjusted · daily · {state?.asOf?new Date(state.asOf).toLocaleString():"No timestamp"}</small>
 {busy?<p>Loading historical observations…</p>:!bars.length?<p style={{color:"#e7bba1"}}>{state?.message||"No historical bars available. Chart intentionally withheld."}</p>:<>
 <svg viewBox="0 0 640 245" width="100%" role="img" aria-label={"Historical daily candlestick chart for "+symbol+" showing "+slice.length+" bars"} style={{display:"block",background:"#071522",borderRadius:10}}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="20" y1={15+i*46} x2="605" y2={15+i*46} stroke="#294657"/><text x="608" y={19+i*46} fill="#adbfcb" fontSize="11">{(max-i*(max-min)/4).toFixed(2)}</text></g>)}
 {slice.map((b,i)=>{const a=x(i);const rising=b.close>=b.open;const color=rising?"#71dcc0":"#ea9385";const lo=Math.min(y(b.open),y(b.close));return <g key={b.time}><line x1={a} y1={y(b.high)} x2={a} y2={y(b.low)} stroke={color} strokeWidth="1.8"/><rect x={a-3.5} y={lo} width="7" height={Math.max(1.5,Math.abs(y(b.open)-y(b.close)))} fill={color}/></g>})}
 <text x="20" y="230" fill="#9bc6d1" fontSize="12">{slice[0]?.time?.slice(0,10)}</text><text x="500" y="230" fill="#9bc6d1" fontSize="12">{slice[slice.length-1]?.time?.slice(0,10)}</text>
 </svg>
 <p style={{fontSize:13,color:"#c5d9e5"}}>Last shown daily close: <strong>${slice[slice.length-1]?.close.toFixed(2)}</strong> · {slice[slice.length-1]?.time.slice(0,10)}</p>
 {replay&&<><label style={{display:"block",color:"#cee3ed"}}>Replay historical candles: {visible} / {bars.length}<input aria-label="Number of historical candles visible" type="range" min="1" max={bars.length} value={Math.max(1,visible)} onChange={e=>setVisible(Number(e.target.value))} style={{width:"100%",accentColor:"#72d6c0",display:"block"}}/></label><button onClick={()=>setVisible(v=>Math.min(bars.length,v+1))} disabled={visible>=bars.length}>Next candle →</button></>}
 <p style={{fontSize:12,color:"#9eb6c5"}}>Historical provider observations only. The chart is not a validated strategy replay, and future bars remain visible only when intentionally advanced in replay mode.</p></>}
 </section>
}
