import {db} from "../db";
import {historicalBars} from "../market/features";

const DAY=86400000;
const HORIZONS=[["1d",1],["5d",5],["20d",20]] as const;

export async function persistDecisionMemory(symbol:string,alignment:any,price:number|null){
  const sql=db();
  const observedAt=new Date().toISOString();
  const hour=observedAt.slice(0,13);
  const id=`${symbol}:${hour}`;
  const blockers=(alignment?.readings??[])
    .filter((r:any)=>r.state==="misaligned"||r.state==="mixed")
    .sort((a:any,b:any)=>Number(Boolean(b.criticalBuy))-Number(Boolean(a.criticalBuy))||Number(a.buyScore??0)-Number(b.buyScore??0))
    .slice(0,12)
    .map((r:any)=>({label:r.label,state:r.state,buyScore:r.buyScore,critical:Boolean(r.criticalBuy||r.critical)}));
  const payload={
    symbol,
    observedAt,
    price:Number.isFinite(Number(price))?Number(price):null,
    buyState:alignment?.buyState??null,
    sellState:alignment?.sellState??null,
    rawBuyState:alignment?.rawBuyState??null,
    buyScore:alignment?.buyScore??null,
    sellScore:alignment?.sellScore??null,
    coverage:alignment?.canonical?.availability??alignment?.availability??null,
    observedGears:alignment?.canonical?.observedTotal??alignment?.observedCount??null,
    adaptiveScore:alignment?.adaptive?.score??null,
    adaptiveObserved:alignment?.adaptive?.observedCount??null,
    institutionalScore:alignment?.institutional?.score??null,
    regimeScore:alignment?.groups?.find((g:any)=>g.group==="Market Regime")?.buyScore??null,
    setupScore:alignment?.groups?.find((g:any)=>g.group==="Setup Quality")?.buyScore??null,
    timingScore:alignment?.groups?.find((g:any)=>g.group==="Timing & Execution")?.buyScore??null,
    riskScore:alignment?.groups?.find((g:any)=>g.group==="Volatility & Risk")?.buyScore??null,
    blockers,
    sourceMode:"paper-decision-memory-v1"
  };
  await sql`
    insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
    select 'decision_memory_observed','symbol',${id},'decision-memory-v1',${JSON.stringify(payload)}::jsonb
    where not exists(
      select 1 from audit_events where event_type='decision_memory_observed' and entity_id=${id}
    )
  `;
  return payload;
}

async function outcomeFor(symbol:string,start:Date,days:number){
  const from=new Date(start.getTime()-2*DAY).toISOString();
  const to=new Date(start.getTime()+(days+6)*DAY).toISOString();
  const bars=await historicalBars(symbol,"1Day",from,80,"sip",to).catch(()=>[]);
  const eligible=bars.filter(b=>Date.parse(b.t)>=start.getTime());
  if(eligible.length<2)return null;
  const first=eligible[0];
  const target=start.getTime()+days*DAY;
  const post=eligible.find(b=>Date.parse(b.t)>=target);
  if(!post)return null;
  const path=eligible.filter(b=>Date.parse(b.t)<=Date.parse(post.t));
  const ret=((post.c-first.c)/first.c)*100;
  const mfe=Math.max(...path.map(b=>((b.h-first.c)/first.c)*100));
  const mae=Math.min(...path.map(b=>((b.l-first.c)/first.c)*100));
  return{
    startPrice:first.c,endPrice:post.c,startAt:first.t,endAt:post.t,
    returnPct:+ret.toFixed(3),maxFavorablePct:+mfe.toFixed(3),maxAdversePct:+mae.toFixed(3)
  };
}

export async function resolveDecisionMemory(limit=48){
  const sql=db();
  const rows=await sql`
    select entity_id,payload,created_at
    from audit_events
    where event_type='decision_memory_observed'
      and created_at<=now()-interval '1 day'
    order by created_at asc
    limit ${limit}
  ` as any[];
  let resolved=0;
  for(const row of rows){
    const p=row.payload??{};
    for(const [horizon,days] of HORIZONS){
      if(Date.now()<new Date(row.created_at).getTime()+days*DAY)continue;
      const id=`${row.entity_id}:${horizon}`;
      const exists=await sql`
        select id from audit_events where event_type='decision_memory_outcome' and entity_id=${id} limit 1
      `;
      if((exists as any[]).length)continue;
      const outcome=await outcomeFor(String(p.symbol),new Date(row.created_at),days);
      if(!outcome)continue;
      const payload={...p,horizon,days,...outcome,resolvedAt:new Date().toISOString()};
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
        values('decision_memory_outcome','symbol',${id},'decision-memory-v1',${JSON.stringify(payload)}::jsonb)
      `;
      resolved++;
    }
  }
  return{checked:rows.length,resolved};
}

export async function decisionMemoryScorecard(days=120){
  const sql=db();
  const rows=await sql`
    select payload
    from audit_events
    where event_type='decision_memory_outcome'
      and created_at>=now()-(${days} * interval '1 day')
    order by created_at desc
    limit 12000
  ` as any[];
  const out=rows.map(r=>r.payload).filter(Boolean);
  const states=["NO TRADE","WATCH","READY","HIGH CONVICTION","MUST BUY"];
  const byState=states.map(state=>{
    const xs=out.filter(x=>x.buyState===state);
    if(!xs.length)return{state,samples:0,avgReturn:null,avgMfe:null,avgMae:null};
    const mean=(k:string)=>+(xs.reduce((s,x)=>s+Number(x[k]??0),0)/xs.length).toFixed(3);
    return{state,samples:xs.length,avgReturn:mean("returnPct"),avgMfe:mean("maxFavorablePct"),avgMae:mean("maxAdversePct")};
  });
  const blockerMap=new Map<string,{samples:number;sumReturn:number;sumMfe:number;sumMae:number}>();
  for(const x of out){
    for(const b of (x.blockers??[]).slice(0,8)){
      const key=String(b.label);
      const cur=blockerMap.get(key)??{samples:0,sumReturn:0,sumMfe:0,sumMae:0};
      cur.samples++;cur.sumReturn+=Number(x.returnPct??0);cur.sumMfe+=Number(x.maxFavorablePct??0);cur.sumMae+=Number(x.maxAdversePct??0);
      blockerMap.set(key,cur);
    }
  }
  const blockers=[...blockerMap.entries()].map(([label,v])=>({
    label,samples:v.samples,
    avgReturn:+(v.sumReturn/v.samples).toFixed(3),
    avgMfe:+(v.sumMfe/v.samples).toFixed(3),
    avgMae:+(v.sumMae/v.samples).toFixed(3)
  })).sort((a,b)=>b.samples-a.samples).slice(0,20);
  return{windowDays:days,totalOutcomes:out.length,byState,blockers,generatedAt:new Date().toISOString()};
}
