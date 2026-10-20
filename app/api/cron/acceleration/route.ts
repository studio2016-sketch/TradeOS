import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {accelerationTick} from "../../../../lib/research/acceleration-collector";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  const result=await accelerationTick();
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({status:"collection_failed",reason:error instanceof Error?error.message:"Unknown",executionAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
