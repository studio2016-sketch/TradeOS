import type {DailyInvocationApproval} from './data-activation-policy';
import {dailyCollectionPlan} from './daily-factor-collection';
import {evidenceTimestamp} from './evidence-time';
/** Manual one-session invocation. No caller-selectable universe, feed, cadence or retry. */
export async function invokeApprovedDailyCollection(input:unknown,approval:DailyInvocationApproval|null,deps:{
 authorized:boolean;clock:()=>Date;preflight:()=>Promise<void>;run:(clock:()=>Date)=>Promise<unknown>;
}){
 if(!deps.authorized)return {httpStatus:401,body:{status:'unauthorized'}};
 if(!approval)return {httpStatus:409,body:{status:'daily_collection_disabled'}};
 const body=input as Record<string,unknown>;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='approvalId,session'||body.approvalId!==approval.id||body.session!==approval.session)return {httpStatus:400,body:{status:'approval_scope_mismatch'}};
 const opens=evidenceTimestamp(approval.opensAt),expires=evidenceTimestamp(approval.expiresAt);
 if(!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(approval.id)||opens===null||expires===null||expires<=opens||expires-opens>BigInt(86400000000000))throw Error('invalid_daily_activation_policy');
 const clock=()=>{const now=deps.clock(),ns=Number.isFinite(+now)?BigInt(+now)*BigInt(1000000):null;
  if(ns===null||ns<opens||ns>=expires)throw Error('daily_approval_window_closed');
  const plan=dailyCollectionPlan(now);
  if(plan.session!==approval.session)throw Error('daily_approval_session_or_deadline_mismatch');
  return now;
 };
 const requireBudget=()=>{const now=clock();if(evidenceTimestamp(dailyCollectionPlan(now).expiresAt)!>expires)throw Error('daily_approval_deadline_budget');return now;};
 requireBudget();await deps.preflight();requireBudget();
 let started=false;
 const runClock=()=>{if(!started){started=true;return requireBudget();}return clock();};
 const result=await deps.run(runClock);
 return {httpStatus:200,body:{status:'daily_invocation_completed',approvalId:approval.id,result,ordersAllowed:false,certified:false}};
}
