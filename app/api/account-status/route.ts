import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
import {db,hasDatabase} from "../../../lib/db";
import {mayAccessResearch,type ResearchPrincipal} from "../../../lib/auth/research-access";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store"};
export async function GET(){
 try{
  const session=await auth.getSession();
  const user=session.data?.user;
  if(!user)return NextResponse.json({authenticated:false,researchAccess:false,reason:"No verified browser session"},{status:401,headers:noStore});
  if(!hasDatabase())return NextResponse.json({authenticated:true,researchAccess:false,reason:"Research authorization database unavailable"},{status:503,headers:noStore});
  const sql=db();
  const rows=await sql`select id::text, "emailVerified" as verified, role, banned from neon_auth."user" where id::text=${user.id} limit 1`;
  const account=rows[0];
  if(!account)return NextResponse.json({authenticated:true,researchAccess:false,reason:"Authenticated account not found in trusted user directory"},{status:403,headers:noStore});
  const isOwner=account.role==="admin" && Boolean(process.env.TRADEOS_OWNER_USER_ID) && account.id===process.env.TRADEOS_OWNER_USER_ID;
  const principal:ResearchPrincipal={userId:String(account.id),emailVerified:account.verified===true,accountDisabled:account.banned===true,role:isOwner?"owner":"unapproved"};
  const access=mayAccessResearch(principal,"read");
  return NextResponse.json({authenticated:true,email:user.email,emailVerified:principal.emailVerified,role:principal.role,researchAccess:access,reason:access?"Verified owner account":!principal.emailVerified?"Email verification required":principal.role==="unapproved"?"Account is not approved for private research":"Research access denied"},{headers:noStore});
 }catch{return NextResponse.json({authenticated:false,researchAccess:false,reason:"Session or authorization service unavailable"},{status:503,headers:noStore});}
}
