import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {alpacaMarketClock,bestSnapshots} from "../../../lib/market/live";

export const dynamic="force-dynamic";

function ageMs(ts:any){
  const t=ts?new Date(ts).getTime():NaN;
  return Number.isFinite(t)?Math.max(0,Date.now()-t):null;
}

export async function GET(){
  const [clock,market]=await Promise.all([
    alpacaMarketClock().catch(()=>null),
    bestSnapshots(["SPY"]).catch(()=>({provider:null,snapshots:[],attempts:[]}))
  ]);
  let dbTimes:any={};
  if(hasDatabase()){
    try{
      const sql=db();
      const rows=await sql`
        select
          (select max(created_at) from audit_events where event_type='ingestion_run') as last_ingestion,
          (select max(created_at) from audit_events where event_type='research_radar_snapshot') as last_research,
          (select max(created_at) from audit_events where event_type='official_source_snapshot') as last_official,
          (select max(event_time) from source_observations) as last_market_observation
      `;
      dbTimes=(rows as any[])[0]??{};
    }catch{}
  }

  const snap=(market as any)?.snapshots?.[0]??null;
  const quoteAge=ageMs(snap?.timestamp);
  const ingestionAge=ageMs(dbTimes.last_ingestion);
  const researchAge=ageMs(dbTimes.last_research);
  const officialAge=ageMs(dbTimes.last_official);
  const marketOpen=Boolean(clock?.isOpen);
  const ingestionHealthy=!marketOpen || (ingestionAge!=null&&ingestionAge<=12*60_000);
  const quoteHealthy=!marketOpen || (quoteAge!=null&&quoteAge<=3*60_000);
  const researchHealthy=researchAge!=null&&researchAge<=40*60_000;
  const providerHealthy=Boolean((market as any)?.provider);
  const state=marketOpen
    ? (ingestionHealthy&&quoteHealthy&&providerHealthy?"live_monitoring":"degraded_monitoring")
    : (researchHealthy?"closed_market_monitoring":"degraded_closed_market");

  return NextResponse.json({
    state,
    market:{
      isOpen:marketOpen,
      clockSource:clock?.source??null,
      clockTimestamp:clock?.timestamp??null,
      nextOpen:clock?.nextOpen??null,
      nextClose:clock?.nextClose??null
    },
    heartbeat:{
      lastIngestion:dbTimes.last_ingestion??null,
      ingestionAgeMs:ingestionAge,
      ingestionHealthy,
      lastResearch:dbTimes.last_research??null,
      researchAgeMs:researchAge,
      researchHealthy,
      lastOfficialSnapshot:dbTimes.last_official??null,
      officialAgeMs:officialAge,
      lastStoredMarketObservation:dbTimes.last_market_observation??null
    },
    provider:{
      active:(market as any)?.provider??null,
      attempts:(market as any)?.attempts??[],
      latestObservation:snap?.timestamp??null,
      latestObservationAgeMs:quoteAge,
      quoteHealthy,
      source:snap?.source??null,
      coverage:snap?.coverage??null,
      entitlement:snap?.entitlement??null
    },
    safety:{executionEligible:false,ordersAllowed:false,mode:"monitoring-only"},
    generatedAt:new Date().toISOString()
  });
}
