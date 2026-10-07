import {NextResponse} from "next/server";
import {latestRegimeContext} from "../../../lib/market/fred";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const data=await latestRegimeContext();
    const usable=Boolean(data.vix||data.tenYear||data.fedFunds);
    return NextResponse.json({mode:usable?"official_daily":"unavailable",...data});
  }catch(error){
    return NextResponse.json({
      mode:"unavailable",
      source:"FRED",
      vix:null,
      tenYear:null,
      fedFunds:null,
      note:"Official daily regime source is not reachable from the current runtime; it is excluded from assessment weighting.",
      error:error instanceof Error?error.message:String(error)
    });
  }
}
