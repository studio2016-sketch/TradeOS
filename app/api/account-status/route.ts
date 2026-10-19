import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const result=await auth.getSession();
  const user=result.data?.user;
  if(!user)return NextResponse.json({authenticated:false,researchAccess:false,reason:"No verified browser session"},{status:401,headers:{"Cache-Control":"private, no-store"}});
  return NextResponse.json({authenticated:true,email:user.email,researchAccess:false,reason:"Owner role enrollment and server authorization are not yet active"},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({authenticated:false,researchAccess:false,reason:"Session service unavailable"},{status:503,headers:{"Cache-Control":"private, no-store"}});}
}
