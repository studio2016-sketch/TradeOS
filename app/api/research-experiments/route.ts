import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request){
 try{
  const session=await auth.getSession();const id=session.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Owner login required"},{status:403,headers});
  const sql=db(),u=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(u[0]?.verified!==true||u[0]?.banned===true||u[0]?.role!=="admin"||!process.env.TRADEOS_OWNER_USER_ID||u[0]?.id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Not authorized"},{status:403,headers});
  const body=await request.json(),investigationId=String(body?.investigationId??""),sha=String(body?.artifactSha256??"");
  if(!/^[a-f0-9-]{36}$/i.test(investigationId)||!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"Invalid identifiers"},{status:400,headers});
  const protocol=body?.protocol;
  if(!protocol||typeof protocol!=="object"||Array.isArray(protocol))return NextResponse.json({error:"Protocol object required"},{status:400,headers});
  const canonical=JSON.stringify(protocol);
  if(canonical.length>12000||canonical.length<10)return NextResponse.json({error:"Invalid protocol length"},{status:400,headers});
  const fingerprint=createHash("sha256").update(canonical).digest("hex");
  const rows=await sql`insert into research_experiment_ledger(owner_id,investigation_id,artifact_id,protocol_sha256,protocol) select ${id},i.id,a.id,${fingerprint},${canonical}::jsonb from research_investigations i join research_artifact_manifest a on a.owner_id=i.owner_id where i.id=${investigationId} and i.owner_id=${id} and a.sha256_hex=${sha} on conflict(owner_id,investigation_id,protocol_sha256) do nothing returning id::text,registered_at`;
  if(!rows.length)return NextResponse.json({error:"Already registered or research identifiers not found; existing experiments cannot be overwritten"},{status:409,headers});
  return NextResponse.json({id:rows[0].id,registeredAt:rows[0].registered_at,protocolSha256:fingerprint,status:"preregistered",modelPromotionAllowed:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Experiment registration unavailable"},{status:503,headers});}
}
export async function GET(){
 try{
  const s=await auth.getSession(),id=s.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Sign in required"},{status:403,headers});
  const sql=db(),u=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(u[0]?.verified!==true||u[0]?.banned===true||u[0]?.role!=="admin"||id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Denied"},{status:403,headers});
  const rows=await sql`select id::text,investigation_id::text,protocol_sha256,registered_at,status from research_experiment_ledger where owner_id=${id} order by registered_at desc limit 100`;
  return NextResponse.json({experiments:rows},{headers});
 }catch{return NextResponse.json({error:"Experiment registry unavailable"},{status:503,headers});}
}
