import type {AlignmentResult,VariableReading} from "./engine";

export type SupervisorState="CLEAR"|"WATCH"|"BLOCK"|"UNAVAILABLE";
export interface SupervisorResult{
  id:string;
  label:string;
  state:SupervisorState;
  score:number|null;
  buyVeto:boolean;
  sellEscalation:number;
  note:string;
  evidence:string[];
}
export interface SupervisoryResult{
  generatedAt:string;
  clearCount:number;
  watchCount:number;
  blockCount:number;
  unavailableCount:number;
  buyVeto:boolean;
  sellEscalation:number;
  supervisors:SupervisorResult[];
}

function available(readings:VariableReading[],labels:string[]){
  return readings.filter(r=>labels.includes(r.label)&&r.buyScore!=null);
}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}
function mk(id:string,label:string,state:SupervisorState,score:number|null,buyVeto:boolean,sellEscalation:number,note:string,evidence:string[]):SupervisorResult{
  return{id,label,state,score,buyVeto,sellEscalation,note,evidence};
}

export function evaluateSupervisors(alignment:AlignmentResult,ctx:any={}):SupervisoryResult{
  const r=alignment.readings;
  const out:SupervisorResult[]=[];

  // 1) Evidence independence / double-counting.
  const observed=r.filter(x=>x.buyScore!=null);
  const sources=observed.map(x=>x.source).filter(Boolean);
  const uniqueSources=new Set(sources);
  const sourceDiversity=sources.length?uniqueSources.size/sources.length:0;
  const independenceScore=sources.length?Math.max(0,Math.min(100,sourceDiversity*140)):null;
  out.push(mk(
    "evidence-independence","Evidence Independence",
    independenceScore==null?"UNAVAILABLE":independenceScore>=70?"CLEAR":independenceScore>=45?"WATCH":"BLOCK",
    independenceScore,
    independenceScore!=null&&independenceScore<45,
    independenceScore!=null&&independenceScore<45?10:0,
    independenceScore==null?"No observed evidence to test for redundancy.":"Penalizes apparent confluence when many gears originate from the same underlying source.",
    sources.length?[...uniqueSources].slice(0,8):[]
  ));

  // 2) Derivatives / dealer positioning.
  const deriv=available(r,["Options liquidity","Expected-move context","Volatility expansion / compression"]);
  const derivScore=avg(deriv.map(x=>x.buyScore as number));
  out.push(mk(
    "derivatives-positioning","Derivatives & Dealer Positioning",
    derivScore==null?"UNAVAILABLE":derivScore>=75?"CLEAR":derivScore>=55?"WATCH":"BLOCK",
    derivScore,
    false,
    derivScore!=null&&derivScore<45?8:0,
    derivScore==null?"Options surface, skew, term structure, dealer-gamma proxy and expiration positioning are not yet connected.":"Uses options-derived risk only when the underlying feed is available and validated.",
    deriv.map(x=>x.label)
  ));

  // 3) Crowding / positioning.
  const crowd=available(r,["Institutional participation","Relative strength vs peers","Sentiment condition","Analyst revision pressure"]);
  const crowdScore=avg(crowd.map(x=>x.buyScore as number));
  out.push(mk(
    "crowding","Crowding & Positioning",
    crowdScore==null?"UNAVAILABLE":crowdScore>=65?"CLEAR":crowdScore>=45?"WATCH":"BLOCK",
    crowdScore,
    false,
    crowdScore!=null&&crowdScore<35?8:0,
    crowdScore==null?"Short interest, borrow stress, fund-flow and positioning feeds are not yet connected.":"Detects when a trade is vulnerable because too many participants already hold the same thesis.",
    crowd.map(x=>x.label)
  ));

  // 4) Cross-asset transmission.
  const cross=available(r,["VIX condition","Yield environment","Dollar risk tone","Market correlation","Market-internals confirmation"]);
  const crossScore=avg(cross.map(x=>x.buyScore as number));
  out.push(mk(
    "cross-asset","Cross-Asset Transmission",
    crossScore==null?"UNAVAILABLE":cross.length>=3&&crossScore>=65?"CLEAR":cross.length>=2?"WATCH":"UNAVAILABLE",
    crossScore,
    false,
    crossScore!=null&&crossScore<40?8:0,
    cross.length<3?"Insufficient independent cross-asset channels are connected.":"Checks whether rates, volatility, dollar and market internals confirm the equity thesis.",
    cross.map(x=>x.label+"="+x.buyScore)
  ));

  // 5) Execution reality.
  const exec=available(r,["Relative liquidity","Bid-ask spread quality","Execution slippage risk","Trigger proximity","Entry precision","Stop-order readiness"]);
  const execScore=avg(exec.map(x=>x.buyScore as number));
  const executionBlock=exec.some(x=>x.hardSell&&x.sellRisk!=null&&x.sellRisk>=85);
  out.push(mk(
    "execution-reality","Execution Reality",
    execScore==null?"UNAVAILABLE":executionBlock||execScore<50?"BLOCK":execScore<75?"WATCH":"CLEAR",
    execScore,
    executionBlock||Boolean(execScore!=null&&execScore<50),
    executionBlock?20:execScore!=null&&execScore<50?10:0,
    execScore==null?"Cannot certify execution quality without live spreads, slippage and order readiness.":"Makes sure a theoretically good setup is actually tradable at realistic prices.",
    exec.map(x=>x.label)
  ));

  // 6) Portfolio concentration.
  const port=available(r,["Correlation exposure","Current open-risk status","Daily-loss-limit status","Position-size compatibility"]);
  const portScore=avg(port.map(x=>x.buyScore as number));
  out.push(mk(
    "portfolio-concentration","Portfolio Concentration",
    portScore==null?"UNAVAILABLE":portScore>=80?"CLEAR":portScore>=60?"WATCH":"BLOCK",
    portScore,
    Boolean(portScore!=null&&portScore<60),
    portScore!=null&&portScore<60?15:0,
    portScore==null?"Account/portfolio exposure is not connected, so concentration cannot be certified.":"Prevents several positions from becoming one hidden correlated bet.",
    port.map(x=>x.label)
  ));

  // 7) Data integrity.
  const availability=alignment.availability;
  const stale=r.filter(x=>x.buyScore!=null&&/stale|unknown/i.test(x.freshness)).length;
  const integrityScore=Math.max(0,Math.min(100,availability-(stale*5)));
  out.push(mk(
    "data-integrity","Data Integrity",
    integrityScore>=85?"CLEAR":integrityScore>=65?"WATCH":"BLOCK",
    integrityScore,
    integrityScore<65,
    integrityScore<50?20:integrityScore<65?10:0,
    "Missing, stale, or conflicting inputs reduce authority rather than being silently substituted.",
    [availability+"/100 variables observed",stale+" stale/unknown observed inputs"]
  ));

  // 8) Explicit uncertainty.
  const calibrationReady=(ctx?.calibration?.sampleCount??0)>=30;
  const availabilityPenalty=100-availability;
  const modelPenalty=calibrationReady?Math.max(0,100-Number(ctx?.calibration?.confidenceMultiplier??.65)*100):35;
  const uncertainty=Math.max(0,Math.min(100,.7*availabilityPenalty+.3*modelPenalty));
  const uncertaintyScore=100-uncertainty;
  out.push(mk(
    "uncertainty","Model Uncertainty",
    uncertaintyScore>=75?"CLEAR":uncertaintyScore>=55?"WATCH":"BLOCK",
    +uncertaintyScore.toFixed(1),
    uncertaintyScore<55,
    uncertaintyScore<40?20:uncertaintyScore<55?10:0,
    calibrationReady?"Combines evidence completeness with measured model calibration.":"Calibration is not mature, so uncertainty remains deliberately elevated.",
    [availability+"% evidence availability",calibrationReady?"Calibration sample sufficient":"Calibration sample insufficient"]
  ));

  return{
    generatedAt:new Date().toISOString(),
    clearCount:out.filter(x=>x.state==="CLEAR").length,
    watchCount:out.filter(x=>x.state==="WATCH").length,
    blockCount:out.filter(x=>x.state==="BLOCK").length,
    unavailableCount:out.filter(x=>x.state==="UNAVAILABLE").length,
    buyVeto:out.some(x=>x.buyVeto),
    sellEscalation:Math.min(50,out.reduce((s,x)=>s+x.sellEscalation,0)),
    supervisors:out
  };
}
