import {NextResponse} from 'next/server';
import {auth} from '../../../../lib/auth/server';
import {db} from '../../../../lib/db';
import {DATA_ACTIVATION_POLICY} from '../../../../lib/research/data-activation-policy';
import {ownerDailyPilotRequest,ownerDailyPilotStatus} from '../../../../lib/research/owner-daily-pilot';
import {dailyRequestBudget,dailyRequestText} from '../../../../lib/research/daily-request-budget';
import {invokeApprovedDailyCollection} from '../../../../lib/research/daily-invocation';
import {assertDataStorageReady} from '../../../../lib/research/data-storage-readiness';
import {runPreparedDailyFactorCollection} from '../../../../lib/research/daily-factor-runner';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!ownerDailyPilotRequest(req))return NextResponse.json({status:'owner_request_required'},{status:403,headers});
 const approval=DATA_ACTIVATION_POLICY.dailyInvocation;
 if(!approval)return NextResponse.json({status:'daily_collection_disabled'},{status:409,headers});
 const budget=dailyRequestBudget();
 try{return await budget.run(async()=>{
  if(await dailyRequestText(req)!=='')return NextResponse.json({status:'empty_request_required'},{status:400,headers});
  const driver=db(),readOnly=budget.sql(driver,true);
  const ownerStatus=await ownerDailyPilotStatus(()=>auth.getSession(),()=>process.env.TRADEOS_OWNER_USER_ID,readOnly);
  if(ownerStatus!==200)return NextResponse.json({status:ownerStatus===503?'authorization_unavailable':'verified_owner_required'},{status:ownerStatus,headers});
  const result=await invokeApprovedDailyCollection({approvalId:approval.id,session:approval.session},approval,{authorized:true,clock:budget.clock,
   preflight:async()=>{budget.requireRunBudget();await assertDataStorageReady(readOnly,'daily');budget.requireRunBudget();},
   run:clock=>{budget.requireRunBudget();return runPreparedDailyFactorCollection(budget.sql(driver),clock);}});
  return NextResponse.json(result.body,{status:result.httpStatus,headers});
 });}catch{return NextResponse.json({status:'daily_invocation_unconfirmed',retryAllowed:false,ordersAllowed:false,certified:false},{status:503,headers});}
}
