import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export const maxDuration=60;

/**
 * Diagnostic only. A second feed from the same vendor is NOT independent.
 * An exchange timestamp in a payload is NOT an independent certification.
 * Never manufacture certification rows from provider observations.
 */
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 const [sources,certifications]=await Promise.all([
  sql`select symbol,source_id,count(*)::int as samples,max(event_time) as newest_event,
   max(received_at) as newest_receipt,
   count(*) filter(where event_time is null or received_at is null)::int as missing_timestamps,
   count(*) filter(where event_time>received_at+interval '5 seconds')::int as future_timestamps
   from source_observations where received_at>now()-interval '2 days'
    and data_class='market_snapshot'
   group by symbol,source_id order by symbol,source_id`,
  sql`select provider,feed,certification_kind,certifier,valid_from,valid_to,
   evidence_reference from tradeos_source_time_certifications
   where certification_kind='exchange_authoritative_timestamp'
   order by valid_from desc limit 100`
 ]);
 const bySymbol=new Map<string,{providers:Set<string>;feeds:Set<string>;samples:number;missing:number;future:number}>();
 for(const r of sources){
  const symbol=String(r.symbol),source=String(r.source_id);
  const item=bySymbol.get(symbol)??{providers:new Set<string>(),feeds:new Set<string>(),samples:0,missing:0,future:0};
  item.providers.add(source.split(":")[0].toLowerCase());
  item.feeds.add(source);item.samples+=Number(r.samples);
  item.missing+=Number(r.missing_timestamps);item.future+=Number(r.future_timestamps);
  bySymbol.set(symbol,item);
 }
 const coverage=[...bySymbol].map(([symbol,x])=>({
  symbol,providerCount:x.providers.size,feeds:[...x.feeds],samples:x.samples,
  missingTimestamps:x.missing,futureTimestamps:x.future,
  sourceTimeCertified:false,
  blockers:[
   ...(x.providers.size<2?["missing_independent_provider"]:[]),
   ...(x.missing>0?["missing_timestamp_fields"]:[]),
   ...(x.future>0?["future_timestamp_anomalies"]:[]),
   "authoritative_provenance_and_point_in_time_attestation_not_verified"
  ]
 }));
 return NextResponse.json({
  status:"source_time_diagnostics",independentlyCertified:0,
  authoritativeCertificationLedgerEntries:certifications.length,
  certificationEntriesAreNotPerObservationProof:true,
  coveredSymbols:coverage.length,coverage,
  marketSources:sources.map(r=>({symbol:r.symbol,source:r.source_id,samples:r.samples,
   newestEvent:r.newest_event,newestReceipt:r.newest_receipt})),
  requirements:[
   "Obtain exchange-authoritative or independently attested timestamp evidence with source identity and immutable evidence hash.",
   "Validate feed entitlement, clock synchronization, retrieval latency, and decision-time availability.",
   "Match each attestation to the exact observation and prospective decision before any scientific gate can pass."
  ],
  warning:"No certification is issued by this audit. Two Alpaca feeds are one provider; historical price agreement does not prove decision-time availability."
 },{headers:{"Cache-Control":"no-store"}});
}
