import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {observedIntradayActivationEvidence} from "../../../../lib/research/intraday-activation-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
import {DATA_ACTIVATION_POLICY} from '../../../../lib/research/data-activation-policy';
import {assertDataStorageReady} from '../../../../lib/research/data-storage-readiness';
import {persistIntradayWithExactSlippage} from '../../../../lib/research/intraday-exact-persistence';
import {runIntradayIngestion,IntradayRunFailure} from '../../../../lib/research/intraday-ingestion-runner';
export const dynamic="force-dynamic";
export const maxDuration=120;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 let completed:Awaited<ReturnType<typeof runIntradayIngestion>>|undefined;
 try{
  completed=await runIntradayIngestion({collect:observedIntradayActivationEvidence,legacy:persistEvidence,
   exact:persistIntradayWithExactSlippage,sql:db,preflight:()=>assertDataStorageReady(db(),'exact'),clock:()=>new Date()},DATA_ACTIVATION_POLICY.exactSlippageWrites);
  const {data,persisted,storagePolicy}=completed;
  await recordCollectorReceipt({collector:"intraday_activation",status:"finished",received:data.candidates.length,saved:persisted.saved,details:{storagePolicy,countsKnown:true,accepted:persisted.accepted,rejected:persisted.rejected,diagnostics:data.diagnostics,retrievedAt:data.retrievedAt}});
  return NextResponse.json({status:"stored_intraday_activation_evidence",storagePolicy,received:data.candidates.length,accepted:persisted.accepted,saved:persisted.saved,rejected:persisted.rejected,diagnostics:data.diagnostics,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"intraday_activation",status:"failed",received:completed?.data.candidates.length??(e instanceof IntradayRunFailure?e.received:0),saved:completed?.persisted.saved??0,details:{error:failureDetail(e),countsKnown:!!completed||(e instanceof IntradayRunFailure&&!e.persistenceAttempted),savedIsLowerBound:!completed,persistenceOutcome:completed?"completed_receipt_failed":e instanceof IntradayRunFailure&&e.persistenceAttempted?"unknown_do_not_assume_zero_or_retry_automatically":"not_started"}});}catch{}
  return NextResponse.json({status:"intraday_activation_failed",error:failureDetail(e),ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
