import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {validateChronologicalForecasts} from "../../../lib/research/chronologicalValidation";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Forecast database not configured"},{status:503});
 const q=new URL(req.url).searchParams;
 const version=(q.get("model")||"").trim();
 if(version&&!/^[A-Za-z0-9_.-]{1,80}$/.test(version))return NextResponse.json({error:"Invalid model identifier"},{status:400});
 try{
  const sql=db();
  const rows=await sql`
   select f.model_version as model,f.horizon as horizon,f.created_at as forecast_time,
   f.probability::float as probability,case when o.was_correct then 1 else 0 end::int as outcome
   from forecast_ledger f inner join forecast_outcomes o on o.forecast_id=f.id
   where o.was_correct is not null and f.probability between 0 and 1
   and (${version}='' or f.model_version=${version})
   order by f.created_at asc limit 5000
  `;
  const grouped=new Map<string,{time:string;probability:number;outcome:0|1}[]>();
  for(const row of rows as any[]){
   const key=String(row.model)+" | "+String(row.horizon);
   const arr=grouped.get(key)||[];
   arr.push({time:new Date(row.forecast_time).toISOString(),probability:Number(row.probability),outcome:Number(row.outcome) as 0|1});
   grouped.set(key,arr);
  }
  const validations=[...grouped].map(([group,samples])=>({modelAndHorizon:group,...validateChronologicalForecasts(samples)}));
  return NextResponse.json({generatedAt:new Date().toISOString(),certification:"RESEARCH_ONLY_NOT_PROMOTED",validations,method:"Chronological 70/30 holdout, frozen training-period base-rate baseline, deterministic resampling of paired squared-error differences. Does not establish a genuinely frozen out-of-sample model, independence, cost-adjusted profitability or proof of adaptive improvement."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Historical research validation unavailable"},{status:503})}
}
