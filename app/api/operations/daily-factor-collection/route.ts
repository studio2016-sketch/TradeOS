import {NextResponse} from 'next/server';
import {authorizeCron} from '../../../../lib/cron';
import {db} from '../../../../lib/db';
import {DATA_ACTIVATION_POLICY} from '../../../../lib/research/data-activation-policy';
import {invokeApprovedDailyCollection} from '../../../../lib/research/daily-invocation';
import {assertDataStorageReady} from '../../../../lib/research/data-storage-readiness';
import {runPreparedDailyFactorCollection} from '../../../../lib/research/daily-factor-runner';
import {dailyRequestBudget,dailyRequestText} from '../../../../lib/research/daily-request-budget';
export const dynamic='force-dynamic';
export const maxDuration=120;
/** POST-only operator trigger; no cron schedule. Source-controlled policy defaults disabled. */
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'},authorized=authorizeCron(req);
 if(!authorized)return NextResponse.json({status:'unauthorized'},{status:401,headers});
 const approval=DATA_ACTIVATION_POLICY.dailyInvocation;
 if(!approval)return NextResponse.json({status:'daily_collection_disabled'},{status:409,headers});
 const budget=dailyRequestBudget();
 try{return await budget.run(async()=>{
  let input:unknown;try{input=JSON.parse(await dailyRequestText(req));}catch{return NextResponse.json({status:'invalid_request'},{status:400,headers});}
  const driver=db(),sql=budget.sql(driver),readOnly=budget.sql(driver,true);
  const result=await invokeApprovedDailyCollection(input,approval,{authorized,clock:budget.clock,
   preflight:async()=>{budget.requireRunBudget();await assertDataStorageReady(readOnly,'daily');budget.requireRunBudget();},
   run:clock=>{budget.requireRunBudget();return runPreparedDailyFactorCollection(sql,clock);}});
  return NextResponse.json(result.body,{status:result.httpStatus,headers});
 });}catch{return NextResponse.json({status:'daily_invocation_unconfirmed',retryAllowed:false,ordersAllowed:false,certified:false},{status:503,headers});}
}
