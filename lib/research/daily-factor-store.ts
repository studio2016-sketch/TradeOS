import {DAILY_COLLECTION_POLICY,DAILY_KEYS,DAILY_SYMBOLS,dailySymbolEvidence,dailyCollectionPlan,type DailyPlan,type DailyResult} from './daily-factor-collection';
import {evidenceTimestamp} from './evidence-time';
import {validateEvidence} from './evidence-gate';
import {EVIDENCE_PERSISTENCE_TIME_POLICY} from './persist-evidence';

/** Explicit injected connection only. Caller must apply the reviewed additive migration first. */
export function dailyFactorStore(sql:any,clock:()=>Date,requireComplete=false){
 let claimed:DailyPlan|undefined;
 function validatePlan(plan:DailyPlan,now:Date){
  if(JSON.stringify(dailyCollectionPlan(new Date(plan.startedAt)))!==JSON.stringify(plan)||
   now.getTime()<Date.parse(plan.startedAt)||now.getTime()>=Date.parse(plan.expiresAt)||
   dailyCollectionPlan(now).session!==plan.session)throw Error('invalid_or_expired_daily_plan');
 }
 return {
  async claim(plan:DailyPlan){
   validatePlan(plan,clock());
   const rows=await sql`insert into tradeos_daily_factor_claims(session,policy,started_at,expires_at)
    select ${plan.session}::date,${DAILY_COLLECTION_POLICY},${plan.startedAt}::timestamptz,${plan.expiresAt}::timestamptz
    where clock_timestamp()>=${plan.startedAt}::timestamptz and clock_timestamp()<${plan.expiresAt}::timestamptz
    on conflict do nothing returning session`;
   if(rows.length!==1)return false;claimed={...plan};return true;
  },
  async finish(plan:DailyPlan,result:DailyResult){
   const now=clock();validatePlan(plan,now);
   if(requireComplete&&result.evidence.length!==DAILY_SYMBOLS.length*DAILY_KEYS.length)throw Error('daily_pilot_incomplete');
   if(!claimed||JSON.stringify(plan)!==JSON.stringify(claimed)||result.evidence.length>72||result.details.policy!==plan.policy||
    result.details.session!==plan.session||result.details.startedAt!==plan.startedAt||typeof result.details.finishedAt!=='string')throw Error('invalid_daily_completion');
   const finished=evidenceTimestamp(result.details.finishedAt);
   if(finished===null||finished<BigInt(Date.parse(plan.startedAt))*BigInt(1000000)||finished>BigInt(now.getTime())*BigInt(1000000))throw Error('invalid_completion_clock');
   const histories=result.details.histories as Record<string,any>;
   if(!histories||Object.keys(histories).sort().join(',')!==[...DAILY_SYMBOLS].sort().join(','))throw Error('invalid_input_histories');
   const reproduced=[];
   for(const symbol of DAILY_SYMBOLS){
    const h=histories[symbol];
    const receipt=evidenceTimestamp(h?.retrievedAt);
    if(receipt===null||receipt>finished||receipt<BigInt(Date.parse(plan.startedAt))*BigInt(1000000))throw Error('invalid_input_receipt');
    if(h.error){if(result.evidence.some(e=>e.subject===symbol))throw Error('evidence_from_failed_history');continue;}
    const replay=dailySymbolEvidence(symbol,{source:h.source,bars:h.bars},plan);
    if(replay.evidence.length===0||!('inputSha256' in replay.provenance)||replay.provenance.inputSha256!==h.inputSha256)throw Error('invalid_input_provenance');
    reproduced.push(...replay.evidence.map(e=>({...e,availableAt:result.details.finishedAt})));
   }
   const canonical=(rows:typeof result.evidence)=>JSON.stringify([...rows].sort((a,b)=>(a.subject+':'+a.factor).localeCompare(b.subject+':'+b.factor)));
   if(canonical(reproduced as typeof result.evidence)!==canonical(result.evidence))throw Error('daily_calculation_replay_mismatch');
   const seen=new Set<string>();
   const rows=result.evidence.map(e=>{
    const identity=e.subject+':'+e.factor,gate=validateEvidence(e,now);
    if(!gate.accepted||!(DAILY_SYMBOLS as readonly string[]).includes(e.subject)||!(DAILY_KEYS as readonly string[]).includes(e.factor)||
     e.domain!=='stock'||e.source!=='Alpaca:iex'||seen.has(identity)||e.availableAt!==result.details.finishedAt||
     e.metadata?.collectionPolicy!==plan.policy||e.metadata?.expectedSession!==plan.session||e.metadata?.sessionClose!==plan.sessionClose)throw Error('daily_evidence_scope_violation');
    seen.add(identity);
    if([e.observedAt,e.availableAt].some(t=>evidenceTimestamp(t)!%BigInt(1000)!==BigInt(0)||Number(t.match(/[+-](\d{2})(?::?\d{2})?$/)?.[1]??0)>=16))throw Error('unsupported_legacy_time');
    return {...e,metadata:{...e.metadata,evidenceIntake:{policyVersion:gate.policyVersion,persistenceTimePolicy:EVIDENCE_PERSISTENCE_TIME_POLICY,observedAt:e.observedAt,availableAt:e.availableAt}}};
   });
   // A single statement: any completion conflict or failed evidence insert rolls everything back.
   // Claims are never deleted/released, including crashes and uncertain commits.
   const done=await sql`with eligible as materialized (
    select session from tradeos_daily_factor_claims where session=${plan.session}::date and policy=${plan.policy}
     and started_at=${plan.startedAt}::timestamptz and expires_at=${plan.expiresAt}::timestamptz
     and clock_timestamp()>=${result.details.finishedAt}::timestamptz and clock_timestamp()<expires_at
     and not exists(select 1 from tradeos_daily_factor_completions where session=${plan.session}::date)
   ), proposed as materialized (
    select * from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(factor text,domain text,subject text,value double precision,source text,"observedAt" text,"availableAt" text,metadata jsonb)
   ), identical_existing as materialized (
    select e.id from proposed x join tradeos_factor_evidence e
     on e.factor_key=x.factor and e.domain=x.domain and e.subject=x.subject and e.source_name=x.source
      and e.observed_at=x."observedAt"::timestamptz and e.available_at=x."availableAt"::timestamptz
    where e.value is not distinct from x.value and e.source_metadata is not distinct from x.metadata
   ), inserted as (
    insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata)
    select x.factor,x.domain,x.subject,x.value,x.source,x."observedAt"::timestamptz,x."availableAt"::timestamptz,x.metadata
    from proposed x
    where exists(select 1 from eligible) on conflict do nothing returning id
   ) insert into tradeos_daily_factor_completions(session,saved,details)
    select session,(select count(*) from inserted),${JSON.stringify(result.details)}::jsonb from eligible
    where tradeos_assert_daily_completion((select count(*)::int from proposed),
     (select count(*)::int from inserted)+(select count(*)::int from identical_existing),${plan.expiresAt}::timestamptz)
    returning saved`;
   if(done.length!==1)throw Error('daily_claim_expired_or_already_finished');
   return Number(done[0].saved);
  },
 };
}
