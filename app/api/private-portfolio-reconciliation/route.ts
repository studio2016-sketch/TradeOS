import {NextResponse} from "next/server";
import {authorizeIngest} from "../../../lib/security";
import {alpacaBrokerReconciliation,alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";
import {reconcileAccountSnapshot} from "../../../lib/research/portfolioReconciliation";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(req:Request){
 if(!authorizeIngest(req))return NextResponse.json({error:"Unauthorized. Private account reconciliation requires administrator access."},{status:401,headers:{"Cache-Control":"private, no-store"}});
 const status=brokerReadStatus();
 if(!status.enabled||!status.environment||!status.credentials)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker read access is not configured or authorized."},{status:503,headers:{"Cache-Control":"private, no-store"}});
 try{
  const [account,history]=await Promise.all([alpacaBrokerState(),alpacaBrokerReconciliation()]);
  if(!account||!history)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker account did not return a valid read-only reconciliation state."},{status:503,headers:{"Cache-Control":"private, no-store"}});
  const snapshot=reconcileAccountSnapshot(account);
  return NextResponse.json({
   mode:"authorized_read_only",
   snapshotConsistency:snapshot,
   transactionHistory:{
    coverage:history.coverage,historyComplete:history.historyComplete,transactionLineageComplete:history.transactionLineageComplete,
    closedOrdersCount:history.closedOrdersCount,fillActivitiesCount:history.fillActivitiesCount,nonTradeActivitiesCount:history.nonTradeActivitiesCount,
    orphanFillOrderCount:history.orphanFillOrderIds.length,filledOrdersMissingActivityCount:history.filledOrdersMissingActivity.length,pages:history.pages
   },
   certification:{
    portfolioReconciled:false,
    reason:"Complete pagination and transaction lineage are necessary but not sufficient. Independent cash-flow, corporate-action, position, order and fill identities must all pass before certification."
   }
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({status:"UNAVAILABLE",reason:"Broker read-only reconciliation failed",error:e instanceof Error?e.message:"unknown"},{status:503,headers:{"Cache-Control":"private, no-store"}})}
}
