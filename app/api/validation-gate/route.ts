import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";

/**
 * Conservative, read-only strategy validation gate.
 * This does NOT establish out-of-sample performance.
 * A true promotion needs frozen point-in-time folds and execution costs.
 */
export async function GET(req:Request){
 if(!hasDatabase())return NextResponse.json({status:"blocked",reason:"Database unavailable",models:[]},{status:503});
 const url=new URL(req.url);
 const requested=(url.searchParams.get("model")||"").trim();
 if(requested&&!/^[A-Za-z0-9_.-]{1,80}$/.test(requested))return NextResponse.json({error:"Invalid model identifier"},{status:400});
 try{
  const sql=db();
  const rows=await sql`
    select f.model_version as model,
           f.horizon as horizon,
           count(*)::int as recorded,
           count(o.forecast_id)::int as resolved,
           count(*) filter (where o.was_correct is not null)::int as labelled,
           count(*) filter (where f.decision='pass')::int as passes,
           avg(case when o.was_correct then 1.0 else 0.0 end) filter (where o.was_correct is not null)::float as observed_frequency,
           avg(f.probability::float) filter (where o.was_correct is not null)::float as mean_probability,
           avg(power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2)) filter (where o.was_correct is not null)::float as brier,
           min(f.created_at) as earliest,
           max(f.created_at) as latest
    from forecast_ledger f
    left join forecast_outcomes o on o.forecast_id=f.id
    where (${requested}='' or f.model_version=${requested})
    group by f.model_version,f.horizon
    order by max(f.created_at) desc
    limit 100`;
  const models=rows.map((r:any)=>{
   const n=Number(r.labelled), total=Number(r.recorded);
   const base=Number(r.observed_frequency);
   const baseline=Number.isFinite(base)?base*(1-base):null;
   const brier=r.brier==null?null:Number(r.brier);
   const skill=baseline!==null&&baseline>0&&brier!==null?1-brier/baseline:null;
   return {model:r.model,horizon:r.horizon,recorded:total,resolved:Number(r.resolved),labelled:n,passes:Number(r.passes),coverage:total?Number((n/total).toFixed(4)):0,brierScore:brier,brierSkillVsObservedBaseRate:skill,meanProbability:r.mean_probability,observedFrequency:r.observed_frequency,firstForecast:r.earliest,lastForecast:r.latest,validation:{status:"RESEARCH_ONLY",historicalSampleSufficient:n>=200,pointInTimeVerified:false,outOfSampleVerified:false,costsVerified:false,independentReplayVerified:false,eligibleForLive:false},warning:"This describes recorded outcomes only. It is not independent walk-forward validation or evidence of profitability."};
  });
  return NextResponse.json({status:"research_only",generatedAt:new Date().toISOString(),models,policy:"No model may promote solely from Brier score, alignment, signal count, or backfilled historical data. Require frozen, chronological out-of-sample tests, point-in-time evidence, costs and reviewed execution simulation."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",models:[],message:"Validation evidence could not be retrieved."},{status:503});}
}
