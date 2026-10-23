import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {ALPACA_IEX_TIME_EVIDENCE,alpacaIexEvidenceSha256} from "../../../../lib/research/source-time-certification";

export const dynamic="force-dynamic";
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const headers={"Cache-Control":"no-store"};
 try{
  const sql=db();
  const rows=await sql`select count(*)::int as rows,
    count(*) filter(where metadata ? 'timestamp' and event_time=(metadata->>'timestamp')::timestamptz)::int as timestamp_matches,
    count(*) filter(where event_time<=received_at)::int as chronologically_received,
    count(*) filter(where metadata->>'coverage'='IEX only')::int as iex_coverage_rows,
    count(*) filter(where metadata->>'entitlement'='partial-real-time')::int as entitlement_rows,
    min(event_time) as first_event,max(event_time) as last_event,max(received_at) as last_received
   from source_observations where source_id='Alpaca:iex' and data_class='market_snapshot'`;
  const audit=rows[0],count=Number(audit?.rows??0);
  const passed=count>=100&&Number(audit?.timestamp_matches)===count&&Number(audit?.chronologically_received)===count&&Number(audit?.iex_coverage_rows)===count&&Number(audit?.entitlement_rows)===count;
  const evidenceSha256=alpacaIexEvidenceSha256();
  if(!passed)return NextResponse.json({status:"BLOCKED",reason:"Live Alpaca IEX rows did not satisfy the pinned timestamp bridge",audit,evidenceSha256,certificateCreated:false},{status:409,headers});
  const active=await sql`select id,provider,feed,certification_kind,certifier,method,evidence_reference,evidence_sha256,valid_from,valid_to,created_at
    from tradeos_source_time_certifications where lower(provider)='alpaca' and lower(feed)='iex'
      and certification_kind='exchange_authoritative_timestamp' and evidence_sha256=${evidenceSha256}
      and valid_to is null order by created_at desc limit 1`;
  if(active.length)return NextResponse.json({status:"CERTIFIED",certificateCreated:false,certificate:active[0],audit,evidenceSha256,scope:"timestamp_semantics_only",approvedForTrading:false},{headers});
  const method=`${ALPACA_IEX_TIME_EVIDENCE.schema}; official Alpaca schema identifies v2/iex and RFC-3339 event timestamps; the official IEX TOPS specification independently defines exchange event timestamps; live raw-ledger conformance requires metadata.timestamp = event_time <= received_at. IEX single-venue scope only.`;
  const inserted=await sql`insert into tradeos_source_time_certifications(provider,feed,certification_kind,certifier,method,evidence_reference,evidence_sha256,valid_from)
    values('alpaca','iex','exchange_authoritative_timestamp',${ALPACA_IEX_TIME_EVIDENCE.certifier},${method},${ALPACA_IEX_TIME_EVIDENCE.documents[0].url},${evidenceSha256},clock_timestamp())
    returning id,provider,feed,certification_kind,certifier,method,evidence_reference,evidence_sha256,valid_from,valid_to,created_at`;
  return NextResponse.json({status:"CERTIFIED",certificateCreated:true,certificate:inserted[0],audit,evidenceSha256,scope:"timestamp_semantics_only",approvedForTrading:false},{headers});
 }catch(error){return NextResponse.json({status:"UNAVAILABLE",reason:error instanceof Error?error.message:"unknown",certificateCreated:false},{status:503,headers});}
}
