import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {signResearchTransfer,storageSigningReady} from "../../../../lib/storage/signed-transfer";
import {validateArtifactInput} from "../../../../lib/storage/file-validation";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession();const id=session.data?.user?.id;
  if(!id)return NextResponse.json({status:"sign_in_required"},{status:401,headers});
  if(!hasDatabase())return NextResponse.json({status:"database_unavailable"},{status:503,headers});
  const sql=db();
  const users=await sql`select id::text,"emailVerified" as verified,role,banned from neon_auth."user" where id::text=${id} limit 1`;
  const user=users[0];
  if(user?.verified!==true||user?.banned===true||user?.role!=="admin"||!process.env.TRADEOS_OWNER_USER_ID||user.id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({status:"not_authorized"},{status:403,headers});
  if(!storageSigningReady())return NextResponse.json({status:"storage_credentials_not_configured",enabled:false},{status:503,headers});
  const body=await request.json();
  const digest=body?.sha256;
  if(typeof digest!=="string"||!/^[a-f0-9]{64}$/.test(digest))return NextResponse.json({status:"invalid_hash"},{status:400,headers});
  const check=validateArtifactInput({size:body.bytes,contentType:body.contentType,filename:body.filename});
  if(!check.allowed)return NextResponse.json({status:"invalid_artifact",reason:check.reason},{status:400,headers});
  const existing=await sql`select id from research_artifact_manifest where owner_id=${id} and sha256_hex=${digest} limit 1`;
  if(existing.length)return NextResponse.json({status:"already_registered"},{status:409,headers});
  const signed=await signResearchTransfer({ownerId:id,sha256:digest,bytes:body.bytes,contentType:body.contentType,operation:"upload"});
  return NextResponse.json({status:"signed_upload",method:"PUT",...signed,contentType:body.contentType,warning:"The returned URL is short-lived and sensitive. Upload is not research-certified until server-side content hash verification and manifest registration."},{headers});
 }catch{return NextResponse.json({status:"signing_unavailable"},{status:503,headers});}
}
