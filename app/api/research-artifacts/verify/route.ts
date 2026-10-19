import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {readResearchObject,signResearchTransfer} from "../../../../lib/storage/signed-transfer";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function authorized(){
 const session=await auth.getSession();const id=session.data?.user?.id;
 if(!id||!hasDatabase())return null;
 const sql=db();const rows=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
 const r=rows[0];
 return r?.verified===true&&r.banned!==true&&r.role==="admin"&&Boolean(process.env.TRADEOS_OWNER_USER_ID)&&r.id===process.env.TRADEOS_OWNER_USER_ID?{id,sql}:null;
}
export async function POST(request:Request){
 try{
  const actor=await authorized();if(!actor)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const body=await request.json();
  const sha=body?.sha256;
  if(typeof sha!=="string"||!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"Invalid fingerprint"},{status:400,headers});
  const kind=body?.kind;
  if(!["report","market_bars","simulation_dataset"].includes(kind))return NextResponse.json({error:"Unsupported artifact class"},{status:400,headers});
  const key="owners/"+actor.id+"/sha256/"+sha.slice(0,2)+"/"+sha;
  const bytes=await readResearchObject(key);
  const actual=createHash("sha256").update(bytes).digest("hex");
  if(actual!==sha)return NextResponse.json({error:"Object checksum mismatch; not registered"},{status:422,headers});
  const contentType=typeof body.contentType==="string"?body.contentType.slice(0,100):"application/octet-stream";
  const records=await actor.sql`insert into research_artifact_manifest(owner_id,artifact_kind,storage_tier,sha256_hex,byte_size,object_key,content_type) values(${actor.id},${kind},'warm_object',${sha},${bytes.byteLength},${key},${contentType}) on conflict(owner_id,sha256_hex) do update set sha256_hex=excluded.sha256_hex returning id::text`;
  return NextResponse.json({verified:true,registered:true,id:records[0]?.id,sha256:actual,bytes:bytes.byteLength},{headers});
 }catch{return NextResponse.json({error:"Upload verification failed; nothing certified"},{status:503,headers});}
}
export async function GET(request:Request){
 try{
  const actor=await authorized();if(!actor)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const sha=new URL(request.url).searchParams.get("sha256")??"";
  if(!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"Invalid fingerprint"},{status:400,headers});
  const rows=await actor.sql`select byte_size::int as bytes, content_type from research_artifact_manifest where owner_id=${actor.id} and sha256_hex=${sha} limit 1`;
  if(!rows.length)return NextResponse.json({error:"Artifact not registered"},{status:404,headers});
  const signed=await signResearchTransfer({ownerId:actor.id,sha256:sha,bytes:Number(rows[0].bytes),contentType:String(rows[0].content_type??"application/octet-stream"),operation:"download"});
  return NextResponse.json({status:"signed_download",url:signed.url,expiresInSeconds:180},{headers});
 }catch{return NextResponse.json({error:"Download authorization failed"},{status:503,headers});}
}
