import {dailyCollectionPlan} from './daily-factor-collection';
type Result={status:string;saved:number;candidates?:number;session?:string};
type Dependencies={authorize:(request:Request)=>boolean;clock:()=>Date;execute:(clock:()=>Date)=>Promise<Result>};
/** Fixed three-symbol research collection. No history replay, model promotion or orders. */
export function scheduledDailyCollection(deps:Dependencies){
 return async function GET(request:Request){
  const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
  if(!deps.authorize(request))return reply({status:'unauthorized'},401);
  if(request.method!=='GET'||new URL(request.url).search||request.body!==null)return reply({status:'parameters_not_supported'},400);
  try{
   const started=deps.clock(),plan=dailyCollectionPlan(started);
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(started);
   if(plan.session!==today)return reply({status:'no_completed_session_today',collectionAttempted:false,certified:false,ordersAllowed:false});
   let previous=+started;
   const clock=()=>{const current=deps.clock();if(!Number.isFinite(+current)||+current<previous||+current>=Date.parse(plan.expiresAt))throw Error('scheduled_collection_clock');previous=+current;return current;};
   const result=await deps.execute(clock);
   if(!['observed_not_certified','already_attempted'].includes(result.status)||!Number.isInteger(result.saved)||result.saved<0||result.saved>72)throw Error('invalid_collection_result');
   return reply({status:result.status,session:plan.session,saved:result.saved,candidates:result.candidates??0,certified:false,ordersAllowed:false,retryAllowed:false});
  }catch{return reply({status:'daily_collection_unconfirmed',retryAllowed:false,certified:false,ordersAllowed:false},503);}
 };
}
