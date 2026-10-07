import {NextResponse} from "next/server";
import {macroRiskContext} from "../../../lib/market/bls";
export const dynamic="force-dynamic";
export async function GET(){
  try{return NextResponse.json({mode:"official_schedule",...(await macroRiskContext())});}
  catch(error){return NextResponse.json({mode:"degraded",error:error instanceof Error?error.message:String(error),events:[]},{status:502});}
}
