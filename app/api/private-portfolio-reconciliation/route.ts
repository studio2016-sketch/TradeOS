import {NextResponse} from "next/server";
import {authorizeIngest} from "../../../lib/security";
import {alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";
import {reconcileAccountSnapshot} from "../../../lib/research/portfolioReconciliation";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 if(!authorizeIngest(req))return NextResponse.json({error:"Unauthorized. Private account reconciliation requires administrator access."},{status:401,headers:{"Cache-Control":"private, no-store"}});
 const status=brokerReadStatus();
 if(!status.enabled||!status.environment||!status.credentials)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker read access is not configured or authorized."},{status:503,headers:{"Cache-Control":"private, no-store"}});
 try{
  const account=await alpacaBrokerState();
  if(!account)return NextResponse.json({status:"UNAVAILABLE",reason:"Broker account did not return a valid state."},{status:503,headers:{"Cache-Control":"private, no-store"}});
  return NextResponse.json({mode:"authorized_read_only",reconciliation:reconcileAccountSnapshot(account),scope:"Snapshot identities only; order fills, cash movements, fees, corporate actions, realized returns and complete P&L are not reconciled."},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Broker read-only reconciliation failed"},{status:503,headers:{"Cache-Control":"private, no-store"}})}
}
