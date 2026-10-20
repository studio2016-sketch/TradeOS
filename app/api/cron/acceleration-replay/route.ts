import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {accelerationReplay} from "../../../../lib/research/acceleration-replay";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 try{return NextResponse.json(await accelerationReplay(),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({status:"replay_failed",error:e instanceof Error?e.message:"Unknown",ordersAllowed:false},{status:503});}
}
