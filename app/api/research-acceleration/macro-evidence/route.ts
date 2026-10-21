import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {observedMacroEvidence} from "../../../../lib/research/official-macro-evidence";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession();
  const id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:"Unauthorized"},{status:403,headers});
  const sql=db();
  const owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=="admin"||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:"Unauthorized"},{status:403,headers});
  return NextResponse.json(await observedMacroEvidence(),{headers});
 }catch{return NextResponse.json({error:"Official macro evidence currently unavailable"},{status:503,headers});}
}
