"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import styles from "./week.module.css";
import SymbolPicker from "../components/SymbolPicker";
import {evaluatePaperCandidate} from "../../lib/paper/integrated";

type Trade={symbol:string;entry:number;exit:number;shares:number;stop:number;target:number;date:string;followedPlan:boolean};
type Progress={done:string[];answers:Record<string,string>;trades:Trade[]};
const KEY="tradeos-week-one-v1";
const days=[
{title:"Start here",goal:"Understand stocks, data quality and the purpose of paper trading.",tasks:[["market","Identify what owning a share means"],["source","Find the source and timestamp of a market quote"],["safety","Explain why paper results are not guaranteed results"]]},
{title:"Find ideas",goal:"Distinguish a promising candidate from an instruction to buy.",tasks:[["candidate","Identify a company and its ticker"],["evidence","List one supporting fact and one counterargument"],["catalyst","Explain what a catalyst is"]]},
{title:"Read the chart",goal:"Recognize candles, trends, volume and a possible invalidation level.",tasks:[["candles","Use the guided chart example"],["trend","Identify whether an illustrative price is rising or falling"],["vwap","Explain VWAP in plain English"]]},
{title:"Plan risk",goal:"Calculate position size before entering any simulated trade.",tasks:[["risk","Calculate the maximum planned loss"],["stop","Set a clear simulated stop level"],["reward","Compare potential reward with planned risk"]]},
{title:"Practice safely",goal:"Record a paper-only plan and its hypothetical exit.",tasks:[["paper","Log an illustrative paper trade"],["discipline","Check whether it followed your plan"],["limits","Explain why stop orders can experience slippage"]]},
{title:"Review decisions",goal:"Evaluate process and mistakes, not just profit.",tasks:[["journal","Review your practice journal"],["sample","Understand why small samples are inconclusive"],["reflection","Write a takeaway offline or in your journal"]]},
{title:"Weekly review",goal:"Assess progress and identify a skill for next week.",tasks:[["score","Review your process score"],["knowledge","Complete the terminology check"],["next","Choose the next lesson based on your gaps"]]}
] as const;
const glossary:Record<string,string>={
"Share":"A small ownership interest in a company.","Ticker":"The abbreviated symbol used to identify a security, such as SPY.","Catalyst":"A verifiable event that may affect price. It does not guarantee direction.","VWAP":"Volume-weighted average price: a reference for the average price paid during the session, weighted by volume.","Volume":"The number of shares traded during a specified period.","Stop":"A preplanned level where a trade idea is considered wrong; actual fills can be worse.","Slippage":"The difference between the planned execution price and the price actually received.","Liquidity":"How readily a security can be traded without significantly affecting its price.","RVOL":"Relative volume: current trading activity compared with a comparable historical baseline.","Risk-to-reward":"The planned potential loss relative to the potential gain; neither is certain.","Backtest":"A simulation of defined rules on historical data, which can overfit and does not guarantee future performance.","Drawdown":"The decline from a portfolio or strategy's prior peak.","Paper trade":"A simulated transaction using no real money. It does not reproduce all market conditions."};
const quiz=[
{term:"Catalyst",question:"What is a catalyst?",options:["A guaranteed price increase","A verifiable event that may influence price","A broker order"],correct:1},
{term:"Stop",question:"Why set a stop before a paper trade?",options:["To define when the idea is wrong","To ensure an exact fill","To guarantee profit"],correct:0},
{term:"Paper trade",question:"What does paper trading prove?",options:["Future profitability","An execution-ready live strategy","How you followed a simulated process"],correct:2}
];
const defaultProgress:Progress={done:[],answers:{},trades:[]};
const isNum=(x:number)=>Number.isFinite(x)&&x>0;
export default function WeekOne(){
 const [p,setP]=useState<Progress>(defaultProgress),[hydrated,setHydrated]=useState(false),[day,setDay]=useState(0),[term,setTerm]=useState("Catalyst"),[step,setStep]=useState(3);
 const [symbol,setSymbol]=useState("SPY"),[entry,setEntry]=useState(""),[stop,setStop]=useState(""),[target,setTarget]=useState(""),[budget,setBudget]=useState("20"),[exit,setExit]=useState(""),[followed,setFollowed]=useState(true);
 const [simulation,setSimulation]=useState<any>(null);const [history,setHistory]=useState<any>(null),[quoteData,setQuoteData]=useState<any>(null),[marketError,setMarketError]=useState(""),[marketBusy,setMarketBusy]=useState(false),[marketRevision,setMarketRevision]=useState(0);const [source,setSource]=useState<any>(null),[health,setHealth]=useState<any>(null),[verification,setVerification]=useState<any>(null),[validation,setValidation]=useState<any>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const v=JSON.parse(raw);if(Array.isArray(v.done)&&Array.isArray(v.trades))setP({done:v.done,answers:v.answers||{},trades:v.trades});}}catch{}setHydrated(true);Promise.allSettled([fetch("/api/connections",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setSource),fetch("/api/health",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setHealth),fetch("/api/data-verification?symbols=SPY,QQQ,NVDA",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setVerification),fetch("/api/validation-gate",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setValidation)]);},[]);
 useEffect(()=>{if(hydrated)localStorage.setItem(KEY,JSON.stringify(p));},[p,hydrated]);
 useEffect(()=>{
  const sym=symbol.trim().toUpperCase();
  setHistory(null);setQuoteData(null);setSimulation(null);setMarketError("");
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(sym))return;
  const controller=new AbortController();setMarketBusy(true);
  Promise.all([fetch("/api/historical-bars?symbol="+encodeURIComponent(sym),{cache:"no-store",signal:controller.signal}).then(r=>r.json()),fetch("/api/market?symbols="+encodeURIComponent(sym),{cache:"no-store",signal:controller.signal}).then(r=>r.json())])
  .then(([h,q])=>{if(controller.signal.aborted)return;setHistory(h);setQuoteData(q);if(!Array.isArray(h?.bars)||!h.bars.length)setMarketError("Historical candles unavailable for "+sym+".");})
  .catch(()=>{if(!controller.signal.aborted)setMarketError("Market data could not be retrieved.");})
  .finally(()=>{if(!controller.signal.aborted)setMarketBusy(false)});
  return()=>controller.abort();
 },[symbol,marketRevision]);

 const tasks=days[day].tasks;
 const done=tasks.filter(t=>p.done.includes(t[0])).length;
 const total=days.reduce((n,d)=>n+d.tasks.length,0);
 const totalDone=p.done.length;
 const e=Number(entry),s=Number(stop),t=Number(target),b=Number(budget),x=Number(exit);
 const valid=isNum(e)&&isNum(s)&&isNum(t)&&isNum(b)&&s<e&&t>e;
 const shares=valid?Math.floor(b/(e-s)):0;
 const risk=shares*(e-s),gain=shares*(t-e);
 const pnl=p.trades.reduce((a,tr)=>a+(tr.exit-tr.entry)*tr.shares,0);
 const planCount=p.trades.filter(tr=>tr.followedPlan).length;
 const quizScore=quiz.filter(q=>p.answers[q.term]===String(q.correct)).length;
 const completion=Math.round((totalDone/total)*100);
 const bars=(history?.bars||[]) as {time:string;open:number;high:number;low:number;close:number;volume:number}[];
 const displayed=bars.slice(0,Math.min(bars.length,step+1));const lows=displayed.map(p=>p.low),highs=displayed.map(p=>p.high);
 const lo=lows.length?Math.min(...lows):0,hi=highs.length?Math.max(...highs):1;
 const chart=displayed.map((v,i)=>`${18+(i*390/Math.max(1,displayed.length-1)).toFixed(1)},${(145-105*(v.close-lo)/(hi-lo||1)).toFixed(1)}`).join(" ");
 const observation=quoteData?.snapshots?.find((v:any)=>v.symbol===symbol.trim().toUpperCase());
 const quoteAge=observation?.timestamp?Date.now()-Date.parse(observation.timestamp):Infinity;
 const verifiedQuote=Boolean(observation&&Number.isFinite(quoteAge)&&quoteAge>=0&&quoteAge<=60000&&Number.isFinite(observation.bid)&&Number.isFinite(observation.ask)&&observation.bid>0&&observation.ask>=observation.bid);
 const checkPaper=()=>{
  if(!valid||!shares||!verifiedQuote){setSimulation({status:"blocked",message:"Current valid provider bid/ask unavailable or trade values invalid. No execution simulation."});return;}
  const sym=symbol.trim().toUpperCase();const amount=e*shares;
  const order={side:"buy" as const,symbol:sym,quantity:shares,limitPrice:e,stopPrice:s,targetPrice:t,maxRisk:b};
  const portfolio={equity:10000,cash:10000,dailyRealizedPnl:0,positions:[],candidate:{symbol:sym,sector:"Unclassified",notional:amount,plannedRisk:(e-s)*shares},limits:{maxPositionPct:15,maxGrossPct:40,maxDailyLoss:100,maxSectorPct:25}};
  const quote={symbol:sym,bid:Number(observation.bid),ask:Number(observation.ask),observedAt:String(observation.timestamp),source:String(observation.source||quoteData?.provider||"Unknown")};
  setSimulation(evaluatePaperCandidate(order,quote,portfolio));
 };
 const toggle=(id:string)=>setP(old=>({...old,done:old.done.includes(id)?old.done.filter(x=>x!==id):[...old.done,id]}));
 const saveTrade=()=>{if(!valid||!shares||!isNum(x)||!symbol.trim())return;setP(old=>({...old,trades:[{symbol:symbol.trim().toUpperCase().slice(0,16),entry:e,exit:x,shares,stop:s,target:t,date:new Date().toISOString(),followedPlan:followed},...old.trades].slice(0,100)}));};
 const providers=source?.connections||[];
 return <main className={styles.wrap}>
 <div className={styles.top}><Link href="/" className={styles.back}>← TradeOS Home</Link><span className={styles.badge}>SIMULATION ONLY · NO ORDERS</span></div>
 <header className={styles.hero}><small>TRADEOS ACADEMY / WEEK 01</small><h1>Your first seven days of trading education</h1><p>One clear goal each day. Learn the terminology, practice with illustrations, and measure your decisions—without placing a trade.</p><div className={styles.progress} role="progressbar" aria-label="Weekly task completion" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{width:completion+"%"}}/></div><strong>{totalDone} of {total} steps complete · {completion}%</strong></header>
 <nav className={styles.days} aria-label="Select lesson day">{days.map((d,i)=><button key={i} type="button" aria-current={day===i?"step":undefined} className={day===i?styles.selected:""} onClick={()=>setDay(i)}><small>DAY {i+1}</small><b>{d.title}</b><span>{d.tasks.filter(t=>p.done.includes(t[0])).length}/3</span></button>)}</nav>
 <section className={styles.two}>
 <article className={styles.card}><small>DAY {day+1} / LEARNING PATH</small><h2>{days[day].title}</h2><p>{days[day].goal}</p><div className={styles.tasks}>{tasks.map(([id,label])=><label key={id}><input type="checkbox" checked={p.done.includes(id)} onChange={()=>toggle(id)}/><span>{label}</span></label>)}</div><p className={styles.note}>Mark a step only after you have completed it. Your progress is saved in this browser, not to a trading account.</p><div className={styles.controls}><button disabled={day===0} onClick={()=>setDay(d=>d-1)}>Previous</button><button disabled={day===6} onClick={()=>setDay(d=>d+1)}>Next lesson →</button></div></article>
 <article className={styles.card}><small>CONNECTION TRUTH PANEL</small><h2>What's actually connected?</h2><p>Configured does not mean recently verified. Data providers may be delayed, unavailable or restricted.</p><div className={styles.status}><b>Database</b><span>{health?.database==="connected"?"Connected (API response)":health?"Unavailable / degraded":"Not verified"}</span></div>{providers.map((v:any)=><div className={styles.status} key={v.id}><b>{v.label}</b><span>{v.status==="connected"?"Configured":v.status==="needs_credentials"?"Credentials missing":v.status==="approval_required"?"Approval required":v.status||"Unknown"}</span></div>)}<p className={styles.note}>Full provider diagnostic requests require operator authorization. Public visitors see non-secret configuration and quote freshness indicators only; they cannot trigger repeated paid or rate-limited provider requests.</p><h3>Freshness check · sample tickers</h3>{verification?.checks?.length?verification.checks.map((v:any)=><div className={styles.status} key={v.symbol}><b>{v.symbol}</b><span>{v.status.replaceAll("_"," ")} · {v.ageMinutes===null?"no timestamp":v.ageMinutes+" min old"} · real-time unverified</span></div>):<p className={styles.note}>Freshness diagnostics unavailable or not checked.</p>}<p className={styles.note}>As-of: {source?.generatedAt?new Date(source.generatedAt).toLocaleString():"not verified"}. Provider status is a configuration check, not an end-to-end quote freshness test. Do not treat displayed example prices as live quotes.</p></article>
 </section>
 <section className={styles.two}>
 <article className={styles.card}><small>LEARN AS YOU GO</small><h2>Trading terminology, translated</h2><div className={styles.chips}>{Object.keys(glossary).map(g=><button className={term===g?styles.selectedChip:""} key={g} onClick={()=>setTerm(g)}>{g}</button>)}</div><div className={styles.definition}><h3>{term}</h3><p>{glossary[term]}</p></div></article>
 <article className={styles.card}><SymbolPicker value={symbol} onChange={setSymbol}/><small>INTERACTIVE HISTORICAL CHART LESSON</small><h2>{symbol.trim().toUpperCase()} · dated price history</h2><p>Chart uses the same Alpaca historical-bar endpoint as TradeOS Market Board; it never invents stock prices. Daily history is not streaming.</p>
 <div className={styles.controls}><button type="button" onClick={()=>setMarketRevision(n=>n+1)} disabled={marketBusy}>{marketBusy?"Fetching…":"Refresh source data"}</button><Link href={"/live-board"}>Open Market Board →</Link></div>
 <p className={styles.note}>Source: {history?.source||"Unavailable"} · Last historical candle: {bars.length?new Date(bars[bars.length-1].time).toLocaleString():"none"} · Provider quote: {observation?.source||"Unavailable"} · {observation?.timestamp?new Date(observation.timestamp).toLocaleString():"No observation"} · {verifiedQuote?"recent bid/ask observed":"no recent valid bid/ask"}</p>
 {marketError&&<p className={styles.error} role="status">{marketError}</p>}
 {bars.length>1?<><svg className={styles.chart} viewBox="0 0 430 180" role="img" aria-label={"Historical daily closing-price line for "+symbol.trim().toUpperCase()+" with "+displayed.length+" dated observations"}><polyline points={chart} fill="none" stroke="#63d7c4" strokeWidth="3" strokeLinejoin="round"/><text x="14" y="171" fill="#b5c5d5" fontSize="12">Historical replay · {displayed.length}/{bars.length} daily bars</text></svg><label className={styles.slider}>Advance recorded daily history <input type="range" min="1" max={bars.length-1} value={Math.min(step,bars.length-1)} onChange={v=>setStep(Number(v.target.value))}/></label><p className={styles.note}>Last visible candle: {displayed.at(-1)?.time.slice(0,10)} · Close ${displayed.at(-1)?.close.toFixed(2)}. This historical progression is not a prediction or a current quote.</p></>:<p className={styles.note}>No real historical candles available. The chart is withheld rather than replaced with a fabricated path.</p>}
 </article>
 </section>
 <section className={styles.two}>
 <article className={styles.card}><small>PAPER-ONLY PRACTICE</small><h2>Size a hypothetical trade</h2><p>Manually enter hypothetical prices. No broker connection, order submission, or live execution occurs.</p><div className={styles.form}>{([["Symbol",symbol,setSymbol],["Entry $",entry,setEntry],["Stop $",stop,setStop],["Target $",target,setTarget],["Max planned risk $",budget,setBudget],["Hypothetical exit $",exit,setExit]] as [string,string,(value:string)=>void][]).map(([l,v,f])=><label key={l}>{l}<input value={v} onChange={event=>f(event.target.value)} inputMode={l==="Symbol"?"text":"decimal"} aria-label={l}/></label>)}</div>{!valid?<p className={styles.error}>Enter positive numbers with stop below entry and target above entry.</p>:<div className={styles.metrics}><div><small>Simulated shares</small><b>{shares}</b></div><div><small>Planned risk</small><b>${risk.toFixed(2)}</b></div><div><small>Potential gain</small><b>${gain.toFixed(2)}</b></div><div><small>Reward / risk</small><b>{risk?(gain/risk).toFixed(2):"—"} : 1</b></div></div>}<label className={styles.check}><input type="checkbox" checked={followed} onChange={v=>setFollowed(v.target.checked)}/> I followed my written plan (self-reported)</label><button className={styles.primary} disabled={!valid||shares===0||marketBusy} onClick={checkPaper}>Check risk + provider-quote execution</button>{simulation&&<p className={styles.note} role="status"><strong>Simulation: {simulation.status}</strong> · {simulation.message||simulation.risk?.blockers?.join("; ")||simulation.execution?.reason||"Within modeled limits"}. Example portfolio $10,000; max position 15%, sector 25%, daily loss $100. Only a recent provider bid/ask permits execution simulation; no broker order.</p>}<button className={styles.primary} disabled={!valid||shares===0||!isNum(x)} onClick={saveTrade}>Record hypothetical outcome in journal</button><p className={styles.note}>Assumes shares fill at entered prices. Fees, spreads, slippage, liquidity, and market impact are excluded. This is not a reliable estimate of live execution.</p></article>
 <article className={styles.card}><small>YOUR PROCESS SCORECARD</small><h2>Practice results</h2><div className={styles.metrics}><div><small>Completed steps</small><b>{completion}%</b></div><div><small>Knowledge check</small><b>{quizScore}/{quiz.length}</b></div><div><small>Paper entries</small><b>{p.trades.length}</b></div><div><small>Plan adherence</small><b>{p.trades.length?Math.round(planCount/p.trades.length*100)+"%":"—"}</b></div></div><h3>Strategy evidence · research only</h3><p className={styles.note}>{validation?.models?.length?validation.models.length+" model/horizon scorecards found. None authorized for live trading.":"Independent historical validation has not been established. No live trading authorization."}</p><h3>Paper journal</h3>{p.trades.length===0?<p>No simulated trades recorded yet.</p>:<div className={styles.journal}>{p.trades.slice(0,10).map((tr,i)=><div key={tr.date+i}><b>{tr.symbol}</b><span>{tr.shares} shares · entry ${tr.entry} → exit ${tr.exit}</span><strong>{(tr.exit-tr.entry)*tr.shares>=0?"+":""}${((tr.exit-tr.entry)*tr.shares).toFixed(2)}</strong></div>)}</div>}<p className={styles.note}>Combined illustrative P/L: ${pnl.toFixed(2)}. The sample is too small to establish a trading edge. Plan adherence is self-reported.</p></article>
 </section>
 <section className={styles.card}><small>WEEK 01 / KNOWLEDGE CHECK</small><h2>Check what you understand</h2><div className={styles.quiz}>{quiz.map(q=><fieldset key={q.term}><legend>{q.question}</legend>{q.options.map((option,i)=><label key={option}><input type="radio" name={q.term} checked={p.answers[q.term]===String(i)} onChange={()=>setP(old=>({...old,answers:{...old.answers,[q.term]:String(i)}}))}/>{option}</label>)}{p.answers[q.term]!==undefined&&<small>{p.answers[q.term]===String(q.correct)?"Correct — nice work.":"Not quite. Review the definition above and try again."}</small>}</fieldset>)}</div></section>
 <footer className={styles.footer}>TradeOS education · No investment advice · No live trades · Information is not a guarantee of future results.</footer>
 </main>;
}