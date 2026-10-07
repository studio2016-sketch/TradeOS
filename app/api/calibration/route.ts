import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {brierScore,calibrationError,confidencePenalty} from "../../../lib/market/calibration";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({mode:"database_unconfigured",sampleCount:0});
 const sql=db();
 const rows=await sql`
  select f.probability::float as p,
         case when o.was_correct then 1 else 0 end::int as outcome
  from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
  where o.was_correct is not null
  order by f.created_at desc limit 5000
 `;
 const samples=rows.map((r:any)=>({p:Number(r.p),outcome:Number(r.outcome) as 0|1}));
 const brier=brierScore(samples),ece=calibrationError(samples);
 return NextResponse.json({mode:"database",sampleCount:samples.length,brier,ece,confidenceMultiplier:confidencePenalty(brier,ece)});
}
