import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function owner(){
 const s=await auth.getSession();const id=s.data?.user?.id;
 if(!id||!hasDatabase())return null;
 const sql=db();const rows=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
 const u=rows[0];
 return u?.verified===true&&u.banned!==true&&u.role==="admin"&&Boolean(process.env.TRADEOS_OWNER_USER_ID)&&u.id===process.env.TRADEOS_OWNER_USER_ID?{id,sql}:null;
}
export async function GET(request:Request){
 try{
  const actor=await owner();if(!actor)return NextResponse.json({error:"Owner access required"},{status:403,headers});
  const investigation=new URL(request.url).searchParams.get("investigationId")??"";
  if(!/^[0-9a-f-]{36}$/i.test(investigation))return NextResponse.json({error:"Invalid investigation"},{status:400,headers});
  const rows=await actor.sql`select e.id::text,e.artifact_id::text,a.sha256_hex,a.artifact_kind,a.byte_size::text,e.source_url,e.source_observed_at,e.notes,e.attached_at from research_investigation_evidence e join research_investigations i on i.id=e.investigation_id and i.owner_id=${actor.id} join research_artifact_manifest a on a.id=e.artifact_id and a.owner_id=${actor.id} where e.investigation_id=${investigation} and e.owner_id=${actor.id} order by e.attached_at desc limit 100`;
  return NextResponse.json({evidence:rows},{headers});
 }catch{return NextResponse.json({error:"Evidence unavailable"},{status:503,headers});}
}
export async function POST(request:Request){
 try{
  const actor=await owner();if(!actor)return NextResponse.json({error:"Owner access required"},{status:403,headers});
  const body=await request.json();
  const investigation=String(body?.investigationId??"");
  const sha=String(body?.sha256??"").toLowerCase();
  if(!/^[0-9a-f-]{36}$/i.test(investigation)||!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"Invalid investigation or fingerprint"},{status:400,headers});
  const source=String(body?.sourceUrl??"").trim();
  if(source&&(source.length>2048||!/^https:\/\//i.test(source)))return NextResponse.json({error:"A source URL must be HTTPS and under 2048 characters"},{status:400,headers});
  const notes=String(body?.notes??"").slice(0,1500);
  const rows=await actor.sql`insert into research_investigation_evidence(investigation_id,artifact_id,owner_id,source_url,notes) select i.id,a.id,${actor.id},${source||null},${notes||null} from research_investigations i cross join research_artifact_manifest a where i.id=${investigation} and i.owner_id=${actor.id} and a.owner_id=${actor.id} and a.sha256_hex=${sha} on conflict(investigation_id,artifact_id) do nothing returning id::text`;
  if(!rows.length)return NextResponse.json({error:"Artifact not found, investigation not found, or already linked"},{status:409,headers});
  return NextResponse.json({linked:true,id:rows[0].id,certified:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Could not link evidence"},{status:503,headers});}
}
