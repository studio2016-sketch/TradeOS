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
