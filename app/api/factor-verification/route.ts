import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
import {db,hasDatabase} from "../../../lib/db";
import {auditFactorVerification,type FactorEvidenceAudit} from "../../../lib/research/factor-verification";
import type {SourceTimeCertificate} from "../../../lib/research/source-time-certification";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const sql=db();
  const owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=="admin"||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const [evidenceRows,certificateRows]=await Promise.all([
   sql`select factor_key,count(*)::int observations,count(distinct subject)::int subjects,
      array_agg(distinct source_name order by source_name) sources,max(available_at) latest_available_at,
      bool_and(observed_at<=available_at) chronology_ok,
      bool_and(value=value and value not in ('Infinity'::float8,'-Infinity'::float8)) finite_ok,
      count(*) filter(where source_name ~* '^Alpaca:iex(?::(?:1Day|1Min))?$' and exists (
        select 1 from tradeos_source_time_certifications c
        where lower(c.provider)='alpaca' and lower(c.feed)='iex'
          and c.certification_kind='exchange_authoritative_timestamp'
          and c.created_at<=tradeos_factor_evidence.available_at
          and c.valid_from<=tradeos_factor_evidence.available_at
          and (c.valid_to is null or tradeos_factor_evidence.available_at<c.valid_to)
      ))::int source_time_eligible_observations
     from tradeos_factor_evidence group by factor_key`,
   sql`select provider,feed,certification_kind,valid_from,valid_to,created_at from tradeos_source_time_certifications order by created_at`
  ]);
  const evidence:FactorEvidenceAudit[]=(evidenceRows as any[]).map(row=>({
   factorKey:String(row.factor_key),observations:Number(row.observations),subjects:Number(row.subjects),
   sourceTimeEligibleObservations:Number(row.source_time_eligible_observations),
   sources:Array.isArray(row.sources)?row.sources.map(String):[],latestAvailableAt:row.latest_available_at?new Date(row.latest_available_at).toISOString():null,
   chronologyOk:Boolean(row.chronology_ok),finiteOk:Boolean(row.finite_ok)
  }));
  const certificates:SourceTimeCertificate[]=(certificateRows as any[]).map(row=>({provider:String(row.provider),feed:String(row.feed),certification_kind:String(row.certification_kind),valid_from:new Date(row.valid_from).toISOString(),valid_to:row.valid_to?new Date(row.valid_to).toISOString():null,created_at:new Date(row.created_at).toISOString()}));
  return NextResponse.json(auditFactorVerification(evidence,certificates,new Date().toISOString()),{headers});
 }catch(error){return NextResponse.json({error:"Factor verification audit unavailable",reason:error instanceof Error?error.message:"unknown"},{status:503,headers});}
}
