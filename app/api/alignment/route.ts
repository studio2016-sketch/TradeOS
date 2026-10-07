import {NextResponse} from "next/server";
import {buildAlignment} from "../../../lib/alignment/engine";
import {latestRegimeContext} from "../../../lib/market/fred";
import {latestSecCatalysts} from "../../../lib/market/sec";
import {bestSnapshots} from "../../../lib/market/live";
import {globalEventRisk} from "../../../lib/market/globalRisk";
import {evaluateSupervisors} from "../../../lib/alignment/supervisors";

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
  const governor=await globalEventRisk(market?.snapshots??[],[symbol,"SPY","QQQ","IWM"]).catch(()=>null);
  const supervisors=evaluateSupervisors(result,{calibration:calibrationRes});
  let governedBuy=governor?.buyClamp?(result.buyState==="MUST BUY"||result.buyState==="HIGH CONVICTION"?"WATCH":result.buyState):result.buyState;
  if(supervisors.buyVeto&&["MUST BUY","HIGH CONVICTION","READY"].includes(governedBuy)) governedBuy="WATCH";
  let governedSell=governor?.capitalGuardOverride?"MUST SELL":governor?.level==="SEVERE"&&result.sellState==="HOLD"?"CAUTION":result.sellState;
  if(supervisors.sellEscalation>=30&&governedSell==="HOLD")governedSell="CAUTION";
  return NextResponse.json({
    ...result,
    buyState:governedBuy,
    sellState:governedSell,
    rawBuyState:result.buyState,
    rawSellState:result.sellState,
    governor,
    supervisors,
    disclaimer:"MUST BUY / MUST SELL are TradeOS state labels for maximum alignment or capital-protection conditions, not guarantees or personalized investment advice."
  });
}
