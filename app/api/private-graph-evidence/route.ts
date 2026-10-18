import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {authorizeIngest} from "../../../lib/security";
import {validateSourcedRelationship} from "../../../lib/research/sourcedRelationship";
export const dynamic="force-dynamic";
export async function POST(req:Request){
 const headers={"Cache-Control":"private, no-store"};
 if(!authorizeIngest(req))return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 if(!hasDatabase())return NextResponse.json({error:"Evidence database unavailable"},{status:503,headers});
 let body:unknown;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400,headers})}
 const validated=validateSourcedRelationship(body);
 if(!validated.valid)return NextResponse.json({error:validated.error},{status:400,headers});
 const r=validated.record;
 try{
  const sql=db();
  const inserted=await sql`
   insert into financial_relationship_evidence
    (subject_kind,subject_id,relation,object_kind,object_id,source_url,source_name,
     source_publication_at,source_observed_at,evidence_excerpt,evidence_sha256,verification_status)
   values(${r.subjectKind},${r.subjectId},${r.relation},${r.objectKind},${r.objectId},${r.sourceUrl},${r.sourceName},
          ${r.publishedAt}::timestamptz,${r.observedAt}::timestamptz,${r.evidenceExcerpt},${validated.checksum},'SOURCE_RECORDED')
   returning id,verification_status
  `;
  return NextResponse.json({status:"SOURCE_RECORDED_NOT_INDEPENDENTLY_VERIFIED",id:String(inserted[0].id),
   fingerprint:validated.checksum,sourceUrl:r.sourceUrl,modelPromotionAllowed:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Could not store source relationship"},{status:503,headers})}
}
