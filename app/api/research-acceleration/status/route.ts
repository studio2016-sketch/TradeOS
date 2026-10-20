import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Owner login required"},{status:403,headers});
  const sql=db();
  const owners=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owners[0]?.role!=="admin"||owners[0]?.banned===true||owners[0]?.verified!==true||id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Not authorized"},{status:403,headers});
  const [observations,trials]=await Promise.all([
   sql`select count(*)::int as rows,count(distinct symbol)::int as symbols,min(recorded_at) as first_seen,max(recorded_at) as last_seen,avg(jsonb_array_length(missing_factors))::float as avg_missing from tradeos_acceleration_observations`,
   sql`select count(*)::int as rows,count(distinct symbol)::int as symbols,count(*)filter(where strategy_mean_net>benchmark_mean_net)::int as beat_unadjusted_baseline from tradeos_acceleration_trials`
  ]);
  return NextResponse.json({study:"100-stock accelerated evidence study",snapshotCount:observations[0]?.rows??0,symbolsObserved:observations[0]?.symbols??0,firstObserved:observations[0]?.first_seen??null,lastObserved:observations[0]?.last_seen??null,meanMeasuredFactorCount:observations[0]?.avg_missing==null?null:120-Number(observations[0].avg_missing),historicalTrials:trials[0]?.rows??0,symbolsReplayed:trials[0]?.symbols??0,rawTrialsBeatingBaseline:trials[0]?.beat_unadjusted_baseline??0,certifiedFindings:0,causalFindings:0,warning:"Trials are correlated exploratory comparisons, not independent validations. No predictive edge, trade signal or causal effect has been certified."},{headers});
 }catch{return NextResponse.json({error:"Acceleration study status unavailable"},{status:503,headers});}
}
