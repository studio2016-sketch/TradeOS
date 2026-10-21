import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {summarizeStoredMarketRecords} from "../../../../lib/research/observed-factor-audit";
export const dynamic="force-dynamic";
export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Owner login required"},{status:403,headers});
  const sql=db();
  const owners=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owners[0]?.role!=="admin"||owners[0]?.banned===true||owners[0]?.verified!==true||id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Not authorized"},{status:403,headers});
  const [observations,trials,universe,observedBySymbol,recentFactors]=await Promise.all([
   sql`select count(*)::int as rows,count(distinct symbol)::int as symbols,min(recorded_at) as first_seen,max(recorded_at) as last_seen,avg(jsonb_array_length(missing_factors))::float as avg_missing from tradeos_acceleration_observations`,
   sql`select count(*)::int as rows,count(distinct symbol)::int as symbols,count(*)filter(where strategy_mean_net>benchmark_mean_net)::int as beat_unadjusted_baseline from tradeos_acceleration_trials`,
   sql`select study_key,symbols,as_of,mode from tradeos_acceleration_universe order by as_of desc limit 1`,
   sql`select symbol,count(*)::int as observations from tradeos_acceleration_observations group by symbol`,
   sql`select market_time,provider,features from tradeos_acceleration_observations order by market_time desc limit 1000`
  ]);
  const directAudit=summarizeStoredMarketRecords(recentFactors.map((r:any)=>({market_time:new Date(r.market_time).toISOString(),provider:String(r.provider),features:r.features})),new Date().toISOString());
  return NextResponse.json({directMarketAudit:directAudit,study:"100-stock accelerated evidence study",frozenUniverse:universe[0]?{studyKey:universe[0].study_key,asOf:universe[0].as_of,selectionMethod:universe[0].mode,symbols:(universe[0].symbols as string[]).map((symbol,index)=>({symbol,rank:index+1,observations:Number(observedBySymbol.find((r:any)=>r.symbol===symbol)?.observations??0)}))}:null,snapshotCount:observations[0]?.rows??0,symbolsObserved:observations[0]?.symbols??0,firstObserved:observations[0]?.first_seen??null,lastObserved:observations[0]?.last_seen??null,meanMeasuredFactorCount:observations[0]?.avg_missing==null?null:120-Number(observations[0].avg_missing),unobservedTickers:universe[0]?(universe[0].symbols as string[]).filter(symbol=>!observedBySymbol.some((r:any)=>r.symbol===symbol)):[],historicalTrials:trials[0]?.rows??0,symbolsReplayed:trials[0]?.symbols??0,rawTrialsBeatingBaseline:trials[0]?.beat_unadjusted_baseline??0,certifiedFindings:0,causalFindings:0,warning:"Trials are correlated exploratory comparisons, not independent validations. No predictive edge, trade signal or causal effect has been certified."},{headers});
 }catch{return NextResponse.json({error:"Acceleration study status unavailable"},{status:503,headers});}
}
