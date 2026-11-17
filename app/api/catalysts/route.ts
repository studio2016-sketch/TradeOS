import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";
import {latestSecCatalysts} from "../../../lib/market/sec";
export const dynamic="force-dynamic";

async function privateGET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")??"NVDA,AMD,PLTR").split(",");
  try{
    const catalysts=await latestSecCatalysts(symbols,5);
    return NextResponse.json({
      mode:"live_authoritative",
      source:"SEC EDGAR",
      generatedAt:new Date().toISOString(),
      symbols,
      catalysts
    });
  }catch(error){
    return NextResponse.json({
      mode:"degraded",
      source:"SEC EDGAR",
      generatedAt:new Date().toISOString(),
      catalysts:[],
      error:error instanceof Error?error.message:"SEC catalyst fetch failed"
    },{status:502});
  }
}

export const GET=withPrivateRead(privateGET);
