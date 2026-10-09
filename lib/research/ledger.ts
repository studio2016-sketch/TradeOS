import {db} from "../db";
import {historicalBars} from "../market/features";
import type {ResearchSubject} from "./subjectDiscovery";

const DAY=86400000;
const HORIZONS=[["1d",1],["5d",5],["20d",20]] as const;

export async function persistResearchSnapshot(snapshot:any){
  const sql=db();
  let subjects=0,experts=0;
  for(const subject of (snapshot.subjects??[]) as ResearchSubject[]){
    await sql`
      insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
      select 'research_subject_observed','research_subject',${subject.id},'research-radar-v1',${JSON.stringify(subject)}::jsonb
      where not exists(
        select 1 from audit_events
        where event_type='research_subject_observed' and entity_id=${subject.id}
      )
    `;
    subjects++;
  }
  for(const expert of snapshot.experts??[]){
    await sql`
      insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
      select 'expert_view_observed','expert_view',${expert.id},'expert-lens-v1',${JSON.stringify(expert)}::jsonb
      where not exists(
        select 1 from audit_events
        where event_type='expert_view_observed' and entity_id=${expert.id}
      )
    `;
    experts++;
  }
  await sql`
    insert into audit_events(event_type,entity_type,model_version,payload)
    values('research_radar_snapshot','system','research-radar-v1',${JSON.stringify(snapshot)}::jsonb)
  `;
  return{subjects,experts};
}

function signedReturn(direction:string,raw:number){
  return direction==="bearish"?-raw:direction==="bullish"?raw:Math.abs(raw);
}

async function outcomeFor(symbol:string,start:Date,days:number){
  const from=new Date(start.getTime()-2*DAY).toISOString();
  const to=new Date(start.getTime()+(days+5)*DAY).toISOString();
  const bars=await historicalBars(symbol,"1Day",from,60,"sip",undefined,to).catch(()=>[]);
  const eligible=bars.filter(b=>new Date(b.t).getTime()>=start.getTime());
  if(eligible.length<2)return null;
  const first=eligible[0];
  const targetTime=start.getTime()+days*DAY;
  const post=eligible.find(b=>new Date(b.t).getTime()>=targetTime)??eligible[eligible.length-1];
  if(new Date(post.t).getTime()<targetTime*.999)return null;
  const raw=first.c?((post.c-first.c)/first.c)*100:null;
  if(raw==null)return null;
  const path=eligible.filter(b=>new Date(b.t).getTime()<=new Date(post.t).getTime());
  const favorable=Math.max(...path.map(b=>first.c?((b.h-first.c)/first.c)*100:0));
  const adverse=Math.min(...path.map(b=>first.c?((b.l-first.c)/first.c)*100:0));
  return{symbol,startPrice:first.c,endPrice:post.c,startAt:first.t,endAt:post.t,returnPct:+raw.toFixed(3),maxUpPct:+favorable.toFixed(3),maxDownPct:+adverse.toFixed(3)};
}

export async function resolveResearchSubjects(limit=18){
  const sql=db();
  const rows=await sql`
    select entity_id,payload,created_at
    from audit_events
    where event_type='research_subject_observed'
      and created_at <= now()-interval '1 day'
    order by created_at asc
    limit ${limit}
  ` as any[];

  let resolved=0,skipped=0;
  const details:any[]=[];
  for(const row of rows){
    const subject=row.payload as ResearchSubject;
    const created=new Date(row.created_at);
    for(const [horizon,days] of HORIZONS){
      if(Date.now()<created.getTime()+days*DAY){continue;}
      const outcomeId=`${row.entity_id}:${horizon}`;
      const exists=await sql`
        select id from audit_events
        where event_type='research_subject_outcome' and entity_id=${outcomeId}
        limit 1
      `;
      if((exists as any[]).length)continue;
      const outcomes=(await Promise.all((subject.symbols??[]).slice(0,6).map(s=>outcomeFor(s,created,days)))).filter(Boolean) as any[];
      if(!outcomes.length){skipped++;continue;}
      const avgRet=outcomes.reduce((s,x)=>s+x.returnPct,0)/outcomes.length;
      const signed=signedReturn(subject.direction,avgRet);
      const success=subject.direction==="mixed"||subject.direction==="neutral"?Math.abs(avgRet)>=1:signed>0;
      const payload={
        subjectId:row.entity_id,subject:subject.subject,scope:subject.scope,direction:subject.direction,
        horizon,days,averageReturnPct:+avgRet.toFixed(3),signedReturnPct:+signed.toFixed(3),success,
        outcomes,sourceScore:subject.score,novelty:subject.novelty,resolvedAt:new Date().toISOString()
      };
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
        values('research_subject_outcome','research_subject',${outcomeId},'research-radar-v1',${JSON.stringify(payload)}::jsonb)
      `;
      resolved++;details.push(payload);
    }
  }
  return{checked:rows.length,resolved,skipped,details};
}

export async function researchScorecard(days=60){
  const sql=db();
  const rows=await sql`
    select payload
    from audit_events
    where event_type='research_subject_outcome'
      and created_at>=now()-(${String(days)}||' days')::interval
    order by created_at desc
    limit 3000
  ` as any[];
  const out=rows.map(r=>r.payload).filter(Boolean);
  const byHorizon=["1d","5d","20d"].map(h=>{
    const xs=out.filter(x=>x.horizon===h);
    const directional=xs.filter(x=>["bullish","bearish"].includes(x.direction));
    const wins=directional.filter(x=>x.success).length;
    return{horizon:h,samples:xs.length,directionalSamples:directional.length,hitRate:directional.length?+(wins/directional.length*100).toFixed(1):null,avgSignedReturn:directional.length?+(directional.reduce((s,x)=>s+Number(x.signedReturnPct||0),0)/directional.length).toFixed(3):null};
  });
  return{windowDays:days,totalOutcomes:out.length,byHorizon,generatedAt:new Date().toISOString()};
}
