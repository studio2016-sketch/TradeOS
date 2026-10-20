import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {FACTOR_CATALOG} from "../../../../lib/research/acceleration-factors";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 try{
  const sql=db();
  const rows=await sql`select f.key,count(*)::int as samples,count(distinct o.symbol)::int as symbols,max(o.market_time) as latest
   from tradeos_acceleration_observations o cross join lateral jsonb_each(o.features) f(key,value)
   where jsonb_typeof(f.value)='number' group by f.key`;
  const measured=new Map(rows.map(r=>[String(r.key),{samples:Number(r.samples),symbols:Number(r.symbols),latest:r.latest}]));
  const factors=FACTOR_CATALOG.map(f=>({...f,...(measured.get(f.key)??{samples:0,symbols:0,latest:null}),state:measured.has(f.key)?"observed_uncertified":"missing"}));
  const invalidLegacy=new Set(["var_95","expected_shortfall","max_drawdown"]);
  for(const factor of factors)if(invalidLegacy.has(factor.key))factor.state="missing";
  const active=factors.filter(f=>f.state==="observed_uncertified").length;
  const freshnessWindowMs=7*86400000;
  const currentTime=Date.now();
  const fresh=factors.filter(f=>f.state==="observed_uncertified"&&f.latest&&currentTime-new Date(f.latest as string).getTime()>=0&&currentTime-new Date(f.latest as string).getTime()<=freshnessWindowMs).length;
  const staleKeys=factors.filter(f=>f.state==="observed_uncertified"&&!(f.latest&&currentTime-new Date(f.latest as string).getTime()>=0&&currentTime-new Date(f.latest as string).getTime()<=freshnessWindowMs)).map(f=>f.key);
  const missingKeys=factors.filter(f=>f.state==="missing").map(f=>f.key);
  const byFamily=Object.fromEntries([...new Set(factors.map(f=>f.family))].map(family=>[family,{observed:factors.filter(f=>f.family===family&&f.state==="observed_uncertified").length,total:10}]));
  return NextResponse.json({status:"measurement_audit_not_certification",generatedAt:new Date().toISOString(),declared:120,observed:active,freshWithinSevenDays:fresh,staleObserved:active-fresh,staleKeys,missing:120-active,missingKeys,byFamily,factors,executionAllowed:false,
   cautions:["Non-null observations do not prove predictive validity.","Some portfolio-risk labels currently contain single-security metrics.","Independent certification is required before trading use."]},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({status:"audit_failed",reason:error instanceof Error?error.message:"unknown"},{status:503});}
}
