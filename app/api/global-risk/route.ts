import {NextResponse} from "next/server";
import {bestSnapshots} from "../../../lib/market/live";
import {globalEventRisk} from "../../../lib/market/globalRisk";
export const dynamic="force-dynamic";
export async function GET(){
  const symbols=["SPY","QQQ","IWM","NVDA","AMD","PLTR"];
  try{
    const market=await bestSnapshots(symbols);
    const risk=await globalEventRisk(market.snapshots,symbols);
    return NextResponse.json({mode:risk.events.length?"provider_news":"awaiting_provider_news",marketProvider:market.provider,...risk});
  }catch(error){
    return NextResponse.json({mode:"degraded",level:"BACKGROUND",score:0,events:[],error:error instanceof Error?error.message:String(error)},{status:502});
  }
}