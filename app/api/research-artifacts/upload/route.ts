import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function POST(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession();
  if(!session.data?.user)return NextResponse.json({status:"sign_in_required",uploadsEnabled:false},{status:401,headers});
  if(!hasDatabase())return NextResponse.json({status:"research_database_unavailable",uploadsEnabled:false},{status:503,headers});
  const sql=db();
  const owners=await sql`select id::text, "emailVerified" as verified,role,banned from neon_auth."user" where id::text=${session.data.user.id} limit 1`;
  const owner=owners[0];
  const valid=owner?.verified===true && owner?.banned!==true && owner?.role==="admin" && Boolean(process.env.TRADEOS_OWNER_USER_ID) && owner?.id===process.env.TRADEOS_OWNER_USER_ID;
  if(!valid)return NextResponse.json({status:"research_access_denied",uploadsEnabled:false},{status:403,headers});
  return NextResponse.json({status:"storage_gateway_pending",authorized:true,uploadsEnabled:false,reason:"Verified owner authorization confirmed. Storage signing is not configured; no file has been transferred."},{status:503,headers});
 }catch{return NextResponse.json({status:"authorization_service_unavailable",uploadsEnabled:false},{status:503,headers});}
}

/** Read-only existence check; never exposes other users' research metadata. */
export async function GET(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const sha=new URL(request.url).searchParams.get("sha256")??"";
  if(!/^[a-f0-9]{64}$/.test(sha))return NextResponse.json({error:"sha256 must be 64 lowercase hexadecimal characters"},{status:400,headers});
  const session=await auth.getSession();
  const userId=session.data?.user?.id;
  if(!userId)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  if(!hasDatabase())return NextResponse.json({error:"Authorization database unavailable"},{status:503,headers});
  const sql=db();
  const actors=await sql`select id::text, "emailVerified" as verified,role,banned from neon_auth."user" where id::text=${userId} limit 1`;
  const actor=actors[0];
  const permitted=actor?.verified===true&&actor?.banned!==true&&actor?.role==="admin"&&Boolean(process.env.TRADEOS_OWNER_USER_ID)&&actor?.id===process.env.TRADEOS_OWNER_USER_ID;
  if(!permitted)return NextResponse.json({error:"Research access denied"},{status:403,headers});
  const registered=await sql`select id::text, artifact_kind,byte_size::text,created_at from research_artifact_manifest where owner_id=${userId} and sha256_hex=${sha} limit 1`;
  return NextResponse.json({registered:registered.length>0,artifact:registered[0]??null,scope:"Authenticated owner's PostgreSQL manifest only; unregistered objects are excluded"},{headers});
 }catch{return NextResponse.json({error:"Artifact lookup unavailable"},{status:503,headers});}
}
