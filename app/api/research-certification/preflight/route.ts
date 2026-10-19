import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {reviewPreflight, type Protocol} from "../../../../lib/research/protocol-preflight";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request){
 try{
  const session=await auth.getSession();const id=session.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Verified owner required"},{status:403,headers});
  const sql=db();
  const rows=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  const user=rows[0];
  if(user?.verified!==true||user.banned===true||user.role!=="admin"||!process.env.TRADEOS_OWNER_USER_ID||user.id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Unauthorized"},{status:403,headers});
  const body=await request.json();const p=body.protocol as Protocol;
  if(!p||typeof p!=="object"||JSON.stringify(p).length>5000)return NextResponse.json({error:"Invalid protocol"},{status:400,headers});
  const investigationId=String(body.investigationId??""),sha=String(body.sha256??"");
  if(!/^[a-f0-9-]{36}$/.test(investigationId)||!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"Invalid research identity"},{status:400,headers});
  const assessment=reviewPreflight(p);
  const matches=await sql`select e.artifact_id::text as artifact_id from research_investigation_evidence e join research_investigations i on i.id=e.investigation_id and i.owner_id=${id} join research_artifact_manifest a on a.id=e.artifact_id and a.owner_id=${id} where e.investigation_id=${investigationId} and e.owner_id=${id} and a.sha256_hex=${sha} limit 1`;
  if(!matches.length)return NextResponse.json({error:"Artifact must be linked to an owned investigation first"},{status:409,headers});
  const decision=assessment.readyForIndependentReview?"candidate_for_independent_review":"insufficient_evidence";
  const reasons=assessment.issues.length?assessment.issues.join("; "):"Protocol checklist passed; independent empirical review still required.";
  await sql`insert into research_certification_reviews(investigation_id,owner_id,evidence_artifact_id,protocol,outcomes,reviewer_id,decision,rationale) values(${investigationId},${id},${matches[0].artifact_id},${JSON.stringify(p)}::jsonb,${JSON.stringify(assessment)}::jsonb,${id},${decision},${reasons})`;
  return NextResponse.json({decision,assessment,modelEligible:false,certified:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Protocol review unavailable"},{status:503,headers});}
}
