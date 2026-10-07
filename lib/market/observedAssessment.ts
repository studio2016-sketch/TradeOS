import {db,hasDatabase} from "../db";
import type {Evidence} from "./types";

type Row={symbol:string;event_time:string;metadata:any;freshness_score:number|null;quality_score:number|null};

function direction(v:number):"bullish"|"bearish"|"neutral"{
  return v>.0015?"bullish":v<-.0015?"bearish":"neutral";
}

export async function observedMarketEvidence():Promise<{evidence:Evidence[];sampleCount:number}|null>{
  if(!hasDatabase())return null;
  const sql=db();
  const rows=await sql`
    select symbol,event_time,metadata,freshness_score,quality_score
    from source_observations
    where data_class='market_snapshot'
      and symbol in ('SPY','QQQ','IWM')
      and event_time >= now()-interval '75 minutes'
    order by symbol,event_time asc
  ` as unknown as Row[];

  const groups=new Map<string,Row[]>();
  for(const r of rows){const a=groups.get(r.symbol)||[];a.push(r);groups.set(r.symbol,a);}
  if([...groups.values()].reduce((s,a)=>s+a.length,0)<9)return null;

  const moves:any[]=[];
  for(const [symbol,a] of groups){
    const clean=a.map(r=>({p:Number(r.metadata?.price??0),vwap:r.metadata?.vwap==null?null:Number(r.metadata.vwap),fresh:Number(r.freshness_score??0),quality:Number(r.quality_score??0)})).filter(x=>x.p>0);
    if(clean.length<3)continue;
    const first=clean[0],last=clean[clean.length-1];
    moves.push({symbol,ret:(last.p-first.p)/first.p,aboveVwap:last.vwap==null?null:last.p>=last.vwap,fresh:clean.reduce((s,x)=>s+x.fresh,0)/clean.length,quality:clean.reduce((s,x)=>s+x.quality,0)/clean.length});
  }
  if(moves.length<2)return null;

  const avgRet=moves.reduce((s,x)=>s+x.ret,0)/moves.length;
  const positive=moves.filter(x=>x.ret>.001).length;
  const negative=moves.filter(x=>x.ret<-.001).length;
  const breadth=(positive-negative)/moves.length;
  const quality=moves.reduce((s,x)=>s+x.quality,0)/moves.length;
  const freshness=moves.reduce((s,x)=>s+x.fresh,0)/moves.length;
  const vwapKnown=moves.filter(x=>x.aboveVwap!==null);
  const vwapRatio=vwapKnown.length?vwapKnown.filter(x=>x.aboveVwap).length/vwapKnown.length:.5;

  const evidence:Evidence[]=[
    {
      id:"observed-index-trend",label:"Index trend",value:Math.min(100,Math.abs(avgRet)*100*25+35),
      direction:direction(avgRet),quality,freshness,independence:.9,sourceIds:["market_snapshots"],
      explanation:`SPY/QQQ/IWM average move over the observed window is ${(avgRet*100).toFixed(2)}%.`
    },
    {
      id:"observed-breadth",label:"ETF breadth proxy",value:Math.min(100,Math.abs(breadth)*70+30),
      direction:breadth>.15?"bullish":breadth<-.15?"bearish":"neutral",quality:quality*.9,freshness,independence:.75,sourceIds:["market_snapshots"],
      explanation:`${positive} of ${moves.length} broad-market proxies are advancing meaningfully; ${negative} are declining.`
    },
    {
      id:"observed-vwap",label:"VWAP alignment",value:Math.abs(vwapRatio-.5)*120+35,
      direction:vwapRatio>.66?"bullish":vwapRatio<.34?"bearish":"neutral",quality:quality*.85,freshness,independence:.65,sourceIds:["market_snapshots"],
      explanation:`${Math.round(vwapRatio*100)}% of observed broad-market proxies are above their provider VWAP reference.`
    }
  ];
  return{evidence,sampleCount:rows.length};
}
