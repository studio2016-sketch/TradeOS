import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {certifyResearch} from "../../../lib/research/certificationAuthority";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Research database disconnected"},{status:503});
 try{
  const sql=db();
  const rows=await sql`
   select (select count(*)::int from forecast_ledger) as total,
    (select count(*)::int from immutable_decision_records) as immutable_records,
    (select count(*)::int from immutable_decision_records
      where observed_at<=recorded_at and source_type='exchange_time_verified') as source_time_verified,
    (select count(*)::int from immutable_decision_records
      where source_type='primary_publication_time_verified') as publication_time_verified
  `;
  const r=(rows as any[])[0];
  const evidence={total:Number(r.total),immutableRecords:Number(r.immutable_records),
   sourceTimeVerified:Number(r.source_time_verified),publicationTimeVerified:Number(r.publication_time_verified),
   outOfSamplePaired:0,independentSessionDates:0,predictiveSkillLowerBound:null,costAdjustedReturnLowerBound:null,
   portfolioReconciled:false,executionSlippageValidated:false};
  return NextResponse.json({generatedAt:new Date().toISOString(),evidence,...certifyResearch(evidence),
   method:"Independent certification authority. Counts are factual. Unverified evidence is never treated as zero-risk or positive validation."},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Certification evidence could not be independently read"},{status:503})}
}
