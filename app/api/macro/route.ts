import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";
import {macroRiskContext} from "../../../lib/market/bls";
export const dynamic="force-dynamic";
async function privateGET(){
  try{return NextResponse.json({mode:"official_schedule",...(await macroRiskContext())});}
  catch(error){return NextResponse.json({mode:"degraded",error:error instanceof Error?error.message:String(error),events:[]},{status:502});}
}

export const GET=withPrivateRead(privateGET);
