import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {authorizeIngest} from "../../../lib/security";
export const dynamic="force-dynamic";
export async function POST(req:Request){
 if(!authorizeIngest(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"DATABASE_URL is not configured"},{status:503});
 const b=await req.json();
 const sql=db();
 const rows=await sql`
  insert into forecast_outcomes
   (forecast_id,realized_return,max_favorable_excursion,max_adverse_excursion,outcome_label,was_correct,notes)
  values
   (${b.forecastId},${b.realizedReturn??null},${b.mfe??null},${b.mae??null},${b.outcomeLabel??null},${b.wasCorrect??null},${b.notes??null})
  on conflict(forecast_id) do nothing
  returning forecast_id,resolved_at
 `;
 if(!rows.length)return NextResponse.json({error:"outcome_already_resolved",message:"Forecast outcomes are immutable after resolution."},{status:409});
 return NextResponse.json({outcome:rows[0]},{status:201});
}
