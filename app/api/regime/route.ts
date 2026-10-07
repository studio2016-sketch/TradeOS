import {NextResponse} from "next/server";
import {latestRegimeContext} from "../../../lib/market/fred";
export const dynamic="force-dynamic";
export async function GET(){
  try{return NextResponse.json({mode:"official_daily",...(await latestRegimeContext())});}
  catch(error){return NextResponse.json({mode:"degraded",error:error instanceof Error?error.message:String(error)},{status:502});}
}
