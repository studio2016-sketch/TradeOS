import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const s=await auth.getSession(),id=s.data?.user?.id;
  if(!id||!hasDatabase())return NextResponse.json({error:"Unavailable"},{status:403,headers});
  const sql=db();
  const u=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  const user=u[0];
  if(user?.verified!==true||user.banned===true||user.role!=="admin"||!process.env.TRADEOS_OWNER_USER_ID||user.id!==process.env.TRADEOS_OWNER_USER_ID)return NextResponse.json({error:"Unauthorized"},{status:403,headers});
  const rows=await sql`select id::text,artifact_kind,sha256_hex,byte_size::text,created_at from research_artifact_manifest where owner_id=${id} order by created_at desc limit 100`;
  return NextResponse.json({artifacts:rows},{headers});
 }catch{return NextResponse.json({error:"Registry unavailable"},{status:503,headers});}
}
