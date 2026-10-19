import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
export const dynamic="force-dynamic";
export async function POST(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession();
  if(!session.data?.user)return NextResponse.json({status:"sign_in_required",uploadsEnabled:false},{status:401,headers});
  return NextResponse.json({status:"storage_gateway_pending",uploadsEnabled:false,reason:"Authentication confirmed. Research authorization and storage signing must pass before transfers."},{status:503,headers});
 }catch{return NextResponse.json({status:"authentication_unavailable",uploadsEnabled:false},{status:503,headers});}
}
