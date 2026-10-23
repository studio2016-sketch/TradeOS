import {createHash} from "node:crypto";

/**
 * Pinned, reviewable evidence for the Alpaca IEX timestamp bridge.
 *
 * This certifies timestamp semantics only. It does not certify consolidated
 * market coverage, price accuracy, predictive value, or execution quality.
 */
export const ALPACA_IEX_TIME_EVIDENCE={
 schema:"tradeos.source-time-evidence.v1",
 provider:"alpaca",
 feed:"iex",
 certificationKind:"exchange_authoritative_timestamp" as const,
 certifier:"TradeOS cross-source specification audit v1",
 documents:[
  {
   authority:"Investors Exchange LLC",
   title:"IEX TOPS Specification v1.66",
   url:"https://storage.googleapis.com/assets-bucket/exchange/assets/IEX%20TOPS%20Specification%20v1.66.pdf",
   claim:"IEX TOPS timestamps are UTC nanoseconds since the POSIX epoch and order events within the IEX Trading System."
  },
  {
   authority:"Alpaca Securities LLC",
   title:"Real-time Stock Data",
   url:"https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data",
   claim:"The v2/iex stream is the Investors Exchange feed and trade and quote t fields are RFC-3339 timestamps with nanosecond precision."
  },
  {
   authority:"Alpaca Securities LLC",
   title:"Market Data FAQ",
   url:"https://docs.alpaca.markets/us/docs/market-data-faq",
   claim:"Stock bars are aggregated from trades and carry the left edge of the interval derived from trade timestamps."
  }
 ],
 implementation:{
  adapter:"lib/market/live.ts",
  rawLedger:"source_observations",
  requiredSourceId:"Alpaca:iex",
  eventTimeRule:"event_time equals the provider timestamp stored in metadata.timestamp",
  receiptRule:"event_time is not later than received_at"
 },
 limitations:[
  "IEX is a single-exchange feed and is not consolidated US market coverage.",
  "A valid exchange timestamp does not prove the economic accuracy or predictive usefulness of a derived factor.",
  "Certification applies prospectively from certificate creation; it must not be backdated to earlier forecasts."
 ]
} as const;

export function alpacaIexEvidenceSha256(){
 return createHash("sha256").update(JSON.stringify(ALPACA_IEX_TIME_EVIDENCE)).digest("hex");
}

export type SourceTimeCertificate={
 provider:string;feed:string;certification_kind:string;
 valid_from:string;valid_to:string|null;created_at:string;
};

/** A certificate can cover a decision only if it already existed at that time. */
export function sourceTimeCertificateCovers(sourceId:string,decisionAt:string,certificate:SourceTimeCertificate){
 const at=Date.parse(decisionAt),created=Date.parse(certificate.created_at),from=Date.parse(certificate.valid_from);
 const to=certificate.valid_to?Date.parse(certificate.valid_to):Number.POSITIVE_INFINITY;
 if(![at,created,from].every(Number.isFinite)||(certificate.valid_to!==null&&!Number.isFinite(to)))return false;
 const [provider="",feed=""]=sourceId.split(":");
 return certificate.certification_kind==="exchange_authoritative_timestamp"
  &&provider.toLowerCase()===certificate.provider.toLowerCase()
  &&feed.toLowerCase()===certificate.feed.toLowerCase()
  &&created<=at&&from<=at&&at<to;
}
