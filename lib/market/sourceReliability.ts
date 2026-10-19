import type {SourceHealth} from "./types";

export interface ReliabilityRow{
  id:string;
  label:string;
  connected:boolean;
  runtimeVerified:boolean;
  freshness:"live"|"current"|"delayed"|"stale"|"unknown"|"unconfigured";
  authority:number;
  coverage:number;
  redundancy:number;
  reliability:number;
  decisionGrade:boolean;
  note:string;
}

function clamp(n:number){return Math.max(0,Math.min(100,n))}
function ageMs(ts:any){
  const t=ts?new Date(ts).getTime():NaN;
  return Number.isFinite(t)?Math.max(0,Date.now()-t):null;
}
function freshnessFromAge(age:number|null,expectedMs:number){
  if(age==null)return {label:"unknown" as const,score:45};
  if(age<=expectedMs)return {label:"live" as const,score:100};
  if(age<=expectedMs*3)return {label:"current" as const,score:88};
  if(age<=expectedMs*10)return {label:"delayed" as const,score:65};
  return {label:"stale" as const,score:25};
}
function latestDateFromData(id:string,data:any){
  if(!data)return null;
  if(id==="cftc"&&Array.isArray(data))return data.map(x=>x.date).filter(Boolean).sort().at(-1)??null;
  if(id==="finra"&&Array.isArray(data)){
    const dates=data.flatMap(x=>[x.regShoDate,x.shortInterest?.settlementDate]).filter(Boolean).sort();
    return dates.at(-1)??null;
  }
  if(id==="treasury")return data.date??null;
  if(id==="bls-data"&&Array.isArray(data)){
    const rows=data.map(x=>String(x.period||"")).filter(Boolean).sort();
    const p=rows.at(-1);
    if(!p)return null;
    const m=String(p).match(/^(\d{4})-M(\d{2})$/);
    return m?new Date(Date.UTC(Number(m[1]),Number(m[2]),1)).toISOString():null;
  }
  return null;
}

export function evaluateSourceReliability(args:{
  configured:SourceHealth[];
  official?:any;
  marketProbe?:any;
}){
  const {configured,official,marketProbe}=args;
  const officialBy=new Map((official?.sources??[]).map((s:any)=>[s.id,s]));
  const chosen=String(marketProbe?.provider??"").toLowerCase();
  const marketSnapshots=marketProbe?.snapshots??[];

  const rows:ReliabilityRow[]=configured.map((s:any)=>{
    const off:any=officialBy.get(s.id);
    const connected=s.state!=="unconfigured";
    let runtimeVerified=Boolean((s as any).runtimeVerified);
    let freshness:"live"|"current"|"delayed"|"stale"|"unknown"|"unconfigured"=connected?"unknown":"unconfigured";
    let freshnessScore=connected?45:0;
    let authority=s.authoritative?95:65;
    let coverage=60;
    let redundancy=35;
    let note=s.note??"";

    if(s.id==="alpaca"||s.id==="massive"){
      const selected=chosen.includes(s.id);
      const snaps=selected?marketSnapshots:[];
      runtimeVerified=selected;
      const latest=snaps.map((x:any)=>ageMs(x.timestamp)).filter((x:any)=>x!=null).sort((a:number,b:number)=>a-b)[0]??null;
      const f=freshnessFromAge(latest,60_000);
      freshness=f.label;freshnessScore=f.score;
      if(s.id==="alpaca"){
        const feed=String(snaps[0]?.source??"");
        coverage=/sip/i.test(feed)?95:/iex/i.test(feed)?55:65;
        note+=(feed?" Active feed: "+feed+".":"");
      }else coverage=95;
      redundancy=(Boolean(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET)&&Boolean(process.env.MASSIVE_API_KEY))?90:35;
    }else if(off){
      runtimeVerified=off.status==="live"||off.status==="degraded";
      if(off.status==="unconfigured"){freshness="unconfigured";freshnessScore=0}
      else{
        const expected=s.id==="cftc"?9*86400000:s.id==="finra"?20*86400000:s.id==="treasury"?2*86400000:s.id==="bls-data"?40*86400000:s.id==="cboe"?2*86400000:7*86400000;
        const ts=latestDateFromData(s.id,off.data);
        const f=ts?freshnessFromAge(ageMs(ts),expected):{label:(off.status==="live"?"current":"unknown") as any,score:off.status==="live"?88:45};
        freshness=f.label;freshnessScore=f.score;
      }
      coverage=s.id==="finra"?75:s.id==="cftc"?82:s.id==="treasury"?92:s.id==="bls-data"?90:s.id==="cboe"?72:80;
      redundancy=["treasury","bls-data","cboe"].includes(s.id)?70:55;
      note=off.error?off.note+" Runtime: "+off.error:off.note;
    }else if(["sec","fred","macro"].includes(s.id)){
      runtimeVerified=Boolean((s as any).runtimeVerified);
      freshness=runtimeVerified?"current":"unknown";
      freshnessScore=runtimeVerified?90:45;
      coverage=s.id==="sec"?95:s.id==="fred"?90:80;
      redundancy=s.id==="fred"?75:60;
    }

    const runtimeScore=runtimeVerified?100:connected?55:0;
    const reliability=clamp(runtimeScore*.22+freshnessScore*.25+authority*.20+coverage*.18+redundancy*.15);
    const decisionGrade=runtimeVerified&&["live","current","delayed"].includes(freshness)&&reliability>=75;
    return{
      id:s.id,label:s.label,connected,runtimeVerified,freshness,authority,coverage,redundancy,
      reliability:+reliability.toFixed(1),decisionGrade,note
    };
  });

  const usable=rows.filter(r=>r.runtimeVerified&&r.freshness!=="stale");
  const decision=rows.filter(r=>r.decisionGrade);
  const score=rows.length?rows.reduce((a,b)=>a+b.reliability,0)/rows.length:0;
  const marketRows=rows.filter(r=>["alpaca","massive"].includes(r.id));
  const consolidatedLive=marketRows.some(r=>r.id==="massive"&&r.decisionGrade)||marketRows.some(r=>r.id==="alpaca"&&r.coverage>=90&&r.decisionGrade);
  return{
    generatedAt:new Date().toISOString(),
    score:+score.toFixed(1),
    verifiedSources:usable.length,
    decisionGradeSources:decision.length,
    totalSources:rows.length,
    consolidatedRealtimeEquities:consolidatedLive,
    independentRealtimeMarketRedundancy:marketRows.filter(r=>r.decisionGrade).length>=2,
    rows
  };
}
