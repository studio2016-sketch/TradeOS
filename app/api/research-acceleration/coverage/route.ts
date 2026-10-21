import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {FACTOR_KEYS} from "../../../../lib/research/acceleration-factors";

export const dynamic="force-dynamic";
export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const sql=db();
  const owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=="admin"||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const generatedAt=new Date().toISOString();
  const rows=await sql`select distinct on(e.factor_key) e.factor_key,e.value,e.domain,e.source_name,e.subject,e.observed_at,e.available_at
   from tradeos_factor_evidence e
   where e.available_at>=now()-interval '24 hours' and e.available_at<=now()
    and e.observed_at<=e.available_at
    and e.value not in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)
    and not (e.factor_key in ('earnings_date','eps_surprise','revenue_surprise','guidance_change','regulatory_change','buyback_announcement','customer_event')
     and e.source_metadata ? 'articleId' and exists(select 1 from tradeos_news_articles n where n.article_id=e.source_metadata->>'articleId' and jsonb_array_length(n.symbols)<>1))
   order by e.factor_key,e.available_at desc`;
  const known=new Set<string>(FACTOR_KEYS),evidence=(rows as any[]).filter(row=>known.has(String(row.factor_key))).map(row=>({factor:String(row.factor_key),value:Number(row.value),domain:String(row.domain),source:String(row.source_name),subject:String(row.subject),observedAt:new Date(row.observed_at).toISOString(),availableAt:new Date(row.available_at).toISOString()}));
  const measured=new Set(evidence.map(row=>row.factor));
  const domains:Record<string,number>={};for(const row of evidence)domains[row.domain]=(domains[row.domain]??0)+1;
  return NextResponse.json({generatedAt,measurementWindowHours:24,measured:measured.size,defined:FACTOR_KEYS.length,operationalTarget:60,targetMet:measured.size>=60,coveragePct:+(measured.size/FACTOR_KEYS.length*100).toFixed(1),domains,evidence,missing:FACTOR_KEYS.filter(key=>!measured.has(key)),certifiedPredictiveFactors:0,approvedForTrading:false,warning:"Coverage counts the newest admissible persisted observation per factor from the last 24 hours. It is not the same factor set for every ticker and does not establish predictive usefulness or profitability."},{headers});
 }catch(error){return NextResponse.json({error:"Live factor coverage unavailable",reason:error instanceof Error?error.message:"unknown"},{status:503,headers});}
}
