import {NextResponse} from "next/server";
import {buildAlignment} from "../../../lib/alignment/engine";
import {latestRegimeContext} from "../../../lib/market/fred";
import {latestSecCatalysts} from "../../../lib/market/sec";
import {bestSnapshots} from "../../../lib/market/live";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbol=(searchParams.get("symbol")||"NVDA").toUpperCase();
  const base=new URL(req.url);
  const origin=base.origin;

  const [assessmentRes,regime,catalysts,market,calibrationRes]=await Promise.all([
    fetch(origin+"/api/assessment",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),
    latestRegimeContext().then(x=>({mode:x.usableCount>0?"official_daily":"unavailable",...x})).catch(()=>null),
    latestSecCatalysts([symbol],8).then(x=>({mode:"live_authoritative",catalysts:x})).catch(()=>null),
    bestSnapshots([symbol]).then(x=>({mode:x.provider?"provider_data":"unconfigured",...x})).catch(()=>null),
    fetch(origin+"/api/calibration",{cache:"no-store"}).then(r=>r.json()).catch(()=>null)
  ]);

  const result=buildAlignment(symbol,{assessment:assessmentRes,regime,catalysts,market,calibration:calibrationRes});
  return NextResponse.json({
    ...result,
    disclaimer:"MUST BUY / MUST SELL are TradeOS state labels for maximum alignment or capital-protection conditions, not guarantees or personalized investment advice."
  });
}
