import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {latestSecCatalysts} from "../../../../lib/market/sec";
import {bestSnapshots} from "../../../../lib/market/live";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  if(!authorizeCron(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  if(!hasDatabase()) return NextResponse.json({error:"database_unconfigured"},{status:503});

  const sql=db();
  const watchlist=(process.env.TRADEOS_WATCHLIST||"NVDA,AMD,PLTR,SPY,QQQ,IWM")
    .split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);

  const started=new Date();
  const results:any={startedAt:started.toISOString(),watchlist,sec:0,market:0,errors:[]};

  try{
    const secSymbols=watchlist.filter(s=>!["SPY","QQQ","IWM"].includes(s));
    const catalysts=await latestSecCatalysts(secSymbols,8);
    for(const c of catalysts){
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,payload)
        select 'catalyst_observed','sec_filing',${c.id},${JSON.stringify(c)}::jsonb
        where not exists(
          select 1 from audit_events where event_type='catalyst_observed' and entity_id=${c.id}
        )
      `;
    }
    results.sec=catalysts.length;
  }catch(e){results.errors.push({source:"sec",error:e instanceof Error?e.message:String(e)});}

  try{
    const market=await bestSnapshots(watchlist);
    for(const s of market.snapshots){
      const eventTime=new Date(s.timestamp);
      const ageMs=Math.max(0,Date.now()-eventTime.getTime());
      const freshness=Math.max(0,Math.min(1,1-ageMs/(20*60*1000)));
      await sql`
        insert into source_observations
          (source_id,data_class,symbol,event_time,latency_ms,freshness_score,quality_score,metadata)
        values
          (${s.source},'market_snapshot',${s.symbol},${s.timestamp},${ageMs},${freshness},${market.provider==='Massive'?0.95:0.85},${JSON.stringify(s)}::jsonb)
      `;
    }
    results.market=market.snapshots.length;
    results.marketProvider=market.provider;
    results.marketAttempts=market.attempts;
  }catch(e){results.errors.push({source:"market",error:e instanceof Error?e.message:String(e)});}

  await sql`
    insert into audit_events(event_type,entity_type,payload)
    values('ingestion_run','system',${JSON.stringify({...results,finishedAt:new Date().toISOString()})}::jsonb)
  `;

  return NextResponse.json({...results,finishedAt:new Date().toISOString()});
}
