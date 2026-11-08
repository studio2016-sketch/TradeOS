import {iexRegularWindow} from './iex-regular-window';
import {evidenceTimestamp} from './evidence-time';
import {PROPOSED_ENTRY_CAPTURE_FINGERPRINT} from './proposed-entry-capture';
import {PROPOSED_QUOTE_OUTCOME_FINGERPRINT} from './proposed-quote-outcome';

export const RECEIPT_DIAGNOSTIC_POLICY={id:'tradeos.quote-receipt-diagnostics.v2',graceMs:900000,maxComparisons:5000000,quantiles:'nearest rank over unique captured horizon-window observation IDs',scope:'timing and regular-session context only; missing endpoint receipt breakdown is not a cause determination'} as const;
const million=BigInt(1000000);
const flags={activated:false,scientificallyCertified:false,sourceTimeCertified:false,eligibleForLive:false} as const;
type Observation={id:string;symbol:string;sourceId:string;quoteAt:string;receivedAt:string};
type ParsedObservation=Observation&{quote:bigint;receipt:bigint};
type Forecast={id:string;symbol:string;created_at:string;horizonMs:number;source_snapshot:{proposedQuoteEntry?:unknown;outcomeProtocol?:unknown}};
type Input={asOf:string;retrievalComplete:boolean;forecasts:Forecast[];observations:Observation[]};
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
function parseObservation(x:any):ParsedObservation|null{
 if(!x||!text(x.id)||!text(x.symbol)||!text(x.sourceId))return null;
 const quote=evidenceTimestamp(x.quoteAt),receipt=evidenceTimestamp(x.receivedAt);
 if(quote===null||receipt===null||quote>receipt)return null;
 return {id:x.id,symbol:x.symbol,sourceId:x.sourceId,quoteAt:x.quoteAt,receivedAt:x.receivedAt,quote,receipt};
}
function quantiles(values:bigint[]){
 const ordered=[...values].sort((a,b)=>a<b?-1:a>b?1:0);
 const at=(p:number)=>ordered.length?ordered[Math.max(0,Math.ceil(p*ordered.length)-1)].toString():null;
 return {sampleCount:ordered.length,unit:'nanoseconds',p50:at(.5),p95:at(.95),p99:at(.99),max:at(1)};
}

/** Offline observational diagnostic. A late receipt is counted, never rewritten or admitted to a calculation. */
export function receiptDelayDiagnostics(raw:unknown){
 const invalid=(reason:string)=>({status:'UNVERIFIED' as const,reason,...flags,policy:RECEIPT_DIAGNOSTIC_POLICY});
 const input=raw as Input;
 if(!input||typeof input!=='object'||!Array.isArray(input.forecasts)||!Array.isArray(input.observations)||typeof input.retrievalComplete!=='boolean')return invalid('INVALID_EXPORT_ENVELOPE');
 const asOf=evidenceTimestamp(input.asOf);if(asOf===null)return invalid('INVALID_AS_OF');
 if(input.forecasts.length>10000||input.observations.length>100000)return invalid('DIAGNOSTIC_LIMIT_EXCEEDED');
 const rows=new Map<string,ParsedObservation>();let futureReceipts=0;
 for(const raw of input.observations){
  const receipt=evidenceTimestamp(raw?.receivedAt);
  if(receipt===null)return invalid('INVALID_RECEIPT');
  if(receipt>asOf){futureReceipts++;continue;}
  const row=parseObservation(raw);if(!row)return invalid('INVALID_OBSERVATION_CHRONOLOGY');
  const previous=rows.get(row.id);
  if(previous&&(previous.symbol!==row.symbol||previous.sourceId!==row.sourceId||previous.quote!==row.quote||previous.receipt!==row.receipt))return invalid('CONFLICTING_OBSERVATION_ID');
  rows.set(row.id,row);
 }
 if(input.forecasts.length*rows.size>RECEIPT_DIAGNOSTIC_POLICY.maxComparisons)return invalid('DIAGNOSTIC_LIMIT_EXCEEDED');
 const forecastIds=new Set<string>(),usedObservations=new Map<string,ParsedObservation>();
 const reports:{forecastId:string;symbol:string;sourceId?:string;status:string;reason?:string;onTimeCapturedQuotes?:number;lateCapturedQuotes?:number;missingReceiptContext?:string;receiptsDuringWindow?:number;preHorizonQuotesReceived?:number;latestQuoteReceivedDuringWindow?:string|null;regularSession?:ReturnType<typeof iexRegularWindow>}[]=[];
 for(const f of input.forecasts){
  if(!f||!text(f.id)||!text(f.symbol)||forecastIds.has(f.id))return invalid('INVALID_OR_DUPLICATE_FORECAST');
  forecastIds.add(f.id);
  const capture=f.source_snapshot?.proposedQuoteEntry as any;
  const forecast=evidenceTimestamp(f.created_at),cutoff=evidenceTimestamp(capture?.capturedAt),entry=parseObservation(capture?.entry);
  // Supplemental evidence is explicitly not promoted into a new protocol binding.
  if(forecast===null||cutoff===null||!entry||capture.status!=='CAPTURED_PROPOSAL'||capture.policyFingerprint!==PROPOSED_ENTRY_CAPTURE_FINGERPRINT||
   capture.outcomeProposalFingerprint!==PROPOSED_QUOTE_OUTCOME_FINGERPRINT||entry.sourceId!=='Alpaca:iex'||entry.symbol!==f.symbol||entry.receipt>cutoff||cutoff>forecast||
   entry.quote<forecast-BigInt(300000)*million||!Number.isSafeInteger(f.horizonMs)||f.horizonMs<=0||asOf<forecast){
   reports.push({forecastId:f.id,symbol:f.symbol,status:'UNVERIFIED',reason:'UNSUPPORTED_OR_INVALID_CAPTURE'});continue;
  }
  const horizon=forecast+BigInt(f.horizonMs)*million,deadline=horizon+BigInt(RECEIPT_DIAGNOSTIC_POLICY.graceMs)*million;
  let onTime=0,late=0,receiptsDuringWindow=0,preHorizonQuotesReceived=0;
  let latestQuote:ParsedObservation|null=null;
  for(const row of rows.values()){
   if(row.sourceId!==entry.sourceId||row.symbol!==f.symbol)continue;
   if(row.receipt>=horizon&&row.receipt<=deadline){
    receiptsDuringWindow++;if(row.quote<horizon)preHorizonQuotesReceived++;
    if(!latestQuote||row.quote>latestQuote.quote||(row.quote===latestQuote.quote&&row.id<latestQuote.id))latestQuote=row;
   }
   if(row.quote<horizon||row.quote>deadline)continue;
   usedObservations.set(row.id,row);
   if(row.receipt<=deadline)onTime++;else late++;
  }
  const status=!input.retrievalComplete?'INCOMPLETE':asOf<=deadline?'PENDING':onTime?'ON_TIME_ENDPOINT_TIMING':late?'LATE_ONLY':'NO_CAPTURED_ENDPOINT';
  reports.push({forecastId:f.id,symbol:f.symbol,sourceId:entry.sourceId,status,onTimeCapturedQuotes:onTime,lateCapturedQuotes:late,receiptsDuringWindow,preHorizonQuotesReceived,latestQuoteReceivedDuringWindow:latestQuote?.quoteAt??null,
   missingReceiptContext:status==='NO_CAPTURED_ENDPOINT'?(receiptsDuringWindow?'PRE_HORIZON_QUOTES_ONLY':'NO_MATCHING_RECEIPTS'):'NOT_ASSESSED',regularSession:iexRegularWindow(horizon,deadline)});
 }
 const count=(status:string)=>reports.filter(r=>r.status===status).length;
 const assessed=count('ON_TIME_ENDPOINT_TIMING')+count('LATE_ONLY')+count('NO_CAPTURED_ENDPOINT');
 const sourceIds=[...new Set([...usedObservations.values()].map(r=>r.sourceId))].sort();
 return {status:'DIAGNOSTIC_ONLY' as const,...flags,policy:RECEIPT_DIAGNOSTIC_POLICY,asOf:input.asOf,retrievalComplete:input.retrievalComplete,
  summary:{forecasts:reports.length,assessed,pending:count('PENDING'),incomplete:count('INCOMPLETE'),unverified:count('UNVERIFIED'),
   onTimeTiming:count('ON_TIME_ENDPOINT_TIMING'),lateOnly:count('LATE_ONLY'),noCapturedEndpoint:count('NO_CAPTURED_ENDPOINT'),
   onTimeTimingRate:assessed?count('ON_TIME_ENDPOINT_TIMING')/assessed:null,lateOnlyRate:assessed?count('LATE_ONLY')/assessed:null,futureReceiptsIgnored:futureReceipts,
   missingWithPreHorizonReceipts:reports.filter(r=>r.missingReceiptContext==='PRE_HORIZON_QUOTES_ONLY').length,missingWithoutWindowReceipts:reports.filter(r=>r.missingReceiptContext==='NO_MATCHING_RECEIPTS').length,
   missingOutsideRegularSession:reports.filter(r=>r.status==='NO_CAPTURED_ENDPOINT'&&r.regularSession?.opportunity==='NONE').length},
  receiptDelays:sourceIds.map(sourceId=>({sourceId,...quantiles([...usedObservations.values()].filter(r=>r.sourceId===sourceId).map(r=>r.receipt-r.quote))})),
  forecasts:reports,limitations:['Timing availability does not validate prices or certify outcomes.','Complete means the supplied stored-observation query was complete, not the provider feed.','Missing and late-only counts are bounded by this as-of; later arrivals can change diagnostics, never the frozen outcome deadline.','Regular-session comparisons do not establish post-market availability, halts, feed completeness or a missing-data cause.','Existing protocol bindings, evidence and certification gates are unchanged.']};
}
