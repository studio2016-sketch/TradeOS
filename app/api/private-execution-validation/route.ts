import {NextResponse} from "next/server";
import {authorizeIngest} from "../../../lib/security";
import {db,hasDatabase} from "../../../lib/db";
import {alpacaBrokerReconciliation,brokerReadStatus} from "../../../lib/broker/alpaca";
import {validateFillSlippage,type FillSlippageRow} from "../../../lib/research/phase5-execution-realism";
export const dynamic="force-dynamic";
export const maxDuration=180;
const headers={"Cache-Control":"private, no-store"};

export async function GET(req:Request){
 if(!authorizeIngest(req))return NextResponse.json({error:"Unauthorized. Fill-slippage validation requires administrator access."},{status:401,headers});
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Database unavailable"},{status:503,headers});
 const broker=brokerReadStatus();
 if(!broker.enabled||!broker.environment||!broker.credentials)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker read access is not configured or authorized."},{status:503,headers});
 try{
  const history=await alpacaBrokerReconciliation();
  if(!history)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker history unavailable"},{status:503,headers});
  const sql=db();
  const fills=history.fills.filter(f=>f.transactionTime&&f.price&&f.qty&&f.qty>0).slice(-500);
  const matched:FillSlippageRow[]=[];const feeds=new Set<string>();let certifiedMatches=0;
  for(const fill of fills){
   const rows=await sql`select so.source_id,so.event_time,so.received_at,so.metadata,
      exists(select 1 from tradeos_source_time_certifications c
        where c.certification_kind='exchange_authoritative_timestamp'
          and lower(c.provider)=lower(split_part(so.source_id,':',1))
          and lower(c.feed)=lower(split_part(so.source_id,':',2))
          and c.created_at<=${fill.transactionTime}::timestamptz
          and c.valid_from<=${fill.transactionTime}::timestamptz
          and (c.valid_to is null or c.valid_to>${fill.transactionTime}::timestamptz)) as independently_certified
    from source_observations so
    where so.symbol=${fill.symbol}
      and so.data_class='market_snapshot'
      and so.event_time<=${fill.transactionTime}::timestamptz
      and so.received_at<=${fill.transactionTime}::timestamptz
      and so.event_time>=${fill.transactionTime}::timestamptz-interval '60 seconds'
    order by so.event_time desc limit 1`;
   const q=(rows as any[])[0];if(!q)continue;
   const bid=Number(q.metadata?.bid),ask=Number(q.metadata?.ask);
   if(!(bid>0)||!(ask>=bid))continue;
   const side=String(fill.side).toLowerCase().startsWith("b")?"buy":"sell";
   matched.push({time:String(fill.transactionTime),side,fillPrice:Number(fill.price),referenceBid:bid,referenceAsk:ask,quantity:Number(fill.qty)});
   feeds.add(String(q.source_id));if(q.independently_certified===true)certifiedMatches++;
  }
  const validation=validateFillSlippage(matched);
  const coverage=fills.length?matched.length/fills.length:0;
  const independent=matched.length>0&&certifiedMatches===matched.length;
  const certified=validation.validated&&coverage>=.9&&independent&&history.historyComplete&&history.transactionLineageComplete;
  const saved=await sql`insert into tradeos_fill_slippage_validations(
    environment,fill_count,matched_quote_count,session_count,volume_weighted_slippage_bps,upper95_slippage_bps,conservative_roundtrip_slippage_fraction,reference_feeds,independently_certified_reference_time,slippage_validated,details
  ) values(
    ${history.environment},${fills.length},${matched.length},${validation.sessions},${validation.volumeWeightedSlippageBps},${validation.upper95Bps},${validation.conservativeRoundTripSlippageFraction},
    ${JSON.stringify([...feeds].sort())}::jsonb,${independent},${certified},
    ${JSON.stringify({quoteMatchCoverage:coverage,historyComplete:history.historyComplete,transactionLineageComplete:history.transactionLineageComplete,rule:"nearest stored quote within 60 seconds that was received before fill; certification additionally requires independent source-time certification"})}::jsonb
  ) returning id,created_at`;
  return NextResponse.json({mode:"authorized_read_only",environment:history.environment,fillsConsidered:fills.length,matchedQuoteCount:matched.length,quoteMatchCoverage:coverage,sessionCount:validation.sessions,volumeWeightedSlippageBps:validation.volumeWeightedSlippageBps,upper95SlippageBps:validation.upper95Bps,conservativeRoundTripSlippageFraction:validation.conservativeRoundTripSlippageFraction,referenceFeeds:[...feeds].sort(),independentlyCertifiedReferenceTime:independent,historyComplete:history.historyComplete,transactionLineageComplete:history.transactionLineageComplete,executionSlippageValidated:certified,snapshot:saved[0]??null,liveExecutionAllowed:false},{headers});
 }catch(e){return NextResponse.json({status:"UNAVAILABLE",reason:"Empirical fill-slippage validation failed",error:e instanceof Error?e.message:"unknown",liveExecutionAllowed:false},{status:503,headers});}
}
