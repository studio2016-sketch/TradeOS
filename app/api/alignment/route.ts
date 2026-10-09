import {NextResponse} from "next/server";
import {buildAlignment} from "../../../lib/alignment/engine";
import {latestRegimeContext} from "../../../lib/market/fred";
import {latestSecCatalysts} from "../../../lib/market/sec";
import {bestSnapshots} from "../../../lib/market/live";
import {globalEventRisk} from "../../../lib/market/globalRisk";
import {evaluateSupervisors} from "../../../lib/alignment/supervisors";
import {evaluateAdaptiveIntelligence} from "../../../lib/alignment/adaptive";
import {alpacaOptionSurface} from "../../../lib/market/options";
import {macroRiskContext} from "../../../lib/market/bls";
import {featureSet} from "../../../lib/market/features";
import {buildMarketContext} from "../../../lib/market/context";
import {buildNewsContext} from "../../../lib/market/newsContext";
import {catalystReactions} from "../../../lib/market/reactions";
import {microstructureContext} from "../../../lib/market/microstructure";
import {latestNewsReaction} from "../../../lib/market/newsReaction";
import {secIssuerContext} from "../../../lib/market/sec";
import {alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbol=(searchParams.get("symbol")||"NVDA").toUpperCase();
  const tradeCountOk=searchParams.get("tradeCountOk")==="1"?true:searchParams.get("tradeCountOk")==="0"?false:undefined;
  const tiltOk=searchParams.get("tiltOk")==="1"?true:searchParams.get("tiltOk")==="0"?false:undefined;
  const base=new URL(req.url);
  const origin=base.origin;

  const [assessmentRes,regime,catalysts,market,calibrationRes,macro,intelligenceRes]=await Promise.all([
    fetch(origin+"/api/assessment",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),
    latestRegimeContext().then(x=>({mode:x.usableCount>0?"official_daily":"unavailable",...x})).catch(()=>null),
    latestSecCatalysts([symbol],8).then(x=>({mode:"live_authoritative",catalysts:x})).catch(()=>null),
    bestSnapshots([symbol]).then(x=>({mode:x.provider?"provider_data":"unconfigured",...x})).catch(()=>null),
    fetch(origin+"/api/calibration",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),
    macroRiskContext().catch(()=>null),
    fetch(origin+"/api/intelligence",{cache:"no-store"}).then(r=>r.json()).catch(()=>null)
  ]);

  const [optionSurface,features,marketContext,newsContext,reactions,microstructure,newsReaction,issuer,brokerState]=await Promise.all([alpacaOptionSurface(symbol,market?.snapshots?.[0]?.price).catch(()=>null),featureSet(symbol).catch(()=>null),buildMarketContext(symbol).catch(()=>null),buildNewsContext(symbol).catch(()=>null),catalystReactions(symbol).catch(()=>[]),microstructureContext(symbol).catch(()=>null),latestNewsReaction(symbol).catch(()=>null),secIssuerContext(symbol).catch(()=>null),brokerReadStatus().enabled?alpacaBrokerState().catch(()=>null):Promise.resolve(null)]);
  const result=buildAlignment(symbol,{assessment:assessmentRes,regime,catalysts,market,calibration:calibrationRes,options:optionSurface,macro,features,marketContext,newsContext,reactions,microstructure,newsReaction,issuer,brokerState,processState:{tradeCountOk,tiltOk}});
  const governor=await globalEventRisk(market?.snapshots??[],[symbol,"SPY","QQQ","IWM"]).catch(()=>null);
  const supervisors=evaluateSupervisors(result,{calibration:calibrationRes,options:optionSurface,regime});
  const adaptive=evaluateAdaptiveIntelligence(result,supervisors,{calibration:calibrationRes,intelligence:intelligenceRes});
  let governedBuy=governor?.buyClamp?(result.buyState==="MUST BUY"||result.buyState==="HIGH CONVICTION"?"WATCH":result.buyState):result.buyState;
  if(supervisors.buyVeto&&["MUST BUY","HIGH CONVICTION","READY"].includes(governedBuy)) governedBuy="WATCH";
  const adaptiveHardBlock=adaptive.gears.some(g=>["execution-realism","uncertainty-control","portfolio-interaction"].includes(g.id)&&g.state==="misaligned");
  if(adaptiveHardBlock&&["MUST BUY","HIGH CONVICTION","READY"].includes(governedBuy)) governedBuy="WATCH";
  const allAdaptiveAligned=adaptive.observedCount===12&&adaptive.alignedCount===12;
  if(governedBuy==="MUST BUY"&&!allAdaptiveAligned){
    governedBuy=adaptive.availability>=75&&adaptive.score>=80?"HIGH CONVICTION":adaptive.score>=65?"READY":"WATCH";
  }
  if(governedBuy==="HIGH CONVICTION"&&(adaptive.availability<50||adaptive.score<65)) governedBuy="READY";
  if(governedBuy==="READY"&&adaptive.score<55) governedBuy="WATCH";
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
    adaptive,
    canonical:{marketGears:108,adaptiveGears:12,totalGears:120,observedMarket:result.observedCount,observedAdaptive:adaptive.observedCount,observedTotal:result.observedCount+adaptive.observedCount,availability:+((result.observedCount+adaptive.observedCount)/120*100).toFixed(1),all120Aligned:Boolean(result.all108Aligned&&adaptive.observedCount===12&&adaptive.alignedCount===12&&!supervisors.buyVeto&&!governor?.buyClamp)},
    optionSurface,
    features,
    marketContext,
    newsContext,
    reactions,
    microstructure,
    newsReaction,
    issuer,
    brokerRead:brokerReadStatus(),
    humanChecks:{tradeCountOk,tiltOk},
    macro,
    disclaimer:"MUST BUY / MUST SELL are TradeOS state labels for maximum alignment or capital-protection conditions, not guarantees or personalized investment advice."
  });
}
