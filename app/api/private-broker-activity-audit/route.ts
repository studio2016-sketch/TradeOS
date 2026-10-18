import {NextResponse} from "next/server";
import {authorizeIngest} from "../../../lib/security";
import {brokerReadStatus,alpacaBrokerState} from "../../../lib/broker/alpaca";
import {readAlpacaActivityCoverage} from "../../../lib/broker/alpacaActivities";
import {reconcileAccountSnapshot} from "../../../lib/research/portfolioReconciliation";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const headers={"Cache-Control":"private, no-store"};
 if(!authorizeIngest(req))return NextResponse.json({status:"UNAUTHORIZED"},{status:401,headers});
 const status=brokerReadStatus();
 if(!status.enabled||!status.credentials||!status.environment)return NextResponse.json({status:"NO_AUTHORIZED_READ",brokerAccess:{enabled:status.enabled,credentialsPresent:status.credentials,environment:status.environment}},{status:503,headers});
 try{
  const [account,activities]=await Promise.all([alpacaBrokerState(),readAlpacaActivityCoverage()]);
  if(!account||!activities)return NextResponse.json({status:"UNAVAILABLE"},{status:503,headers});
  const snapshot=reconcileAccountSnapshot(account);
  return NextResponse.json({status:"PARTIAL_HISTORY_NOT_CERTIFIED",snapshot,activityCoverage:activities,
   accountReadAuthorized:true,accountAccessible:true,transactionHistoryComplete:false,
   certification:"BLOCKED_UNTIL_BALANCE_AND_CASHFLOW_RECONCILIATION",
   note:"Only summarized coverage; cannot certify inception balance, dividends, fills, fees, cash movements and realized P&L without independently reconciled complete account history."},{headers});
 }catch{return NextResponse.json({status:"BROKER_ACTIVITY_UNAVAILABLE",accountReadAuthorized:true,
  accountAccessible:null,transactionHistoryComplete:false},{status:503,headers})}
}
