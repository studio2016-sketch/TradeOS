import {NextResponse} from 'next/server';
import {authorizeCron} from '../../../../lib/cron';
import {db} from '../../../../lib/db';
import {DATA_ACTIVATION_POLICY} from '../../../../lib/research/data-activation-policy';
import {invokeApprovedDailyCollection} from '../../../../lib/research/daily-invocation';
import {assertDataStorageReady} from '../../../../lib/research/data-storage-readiness';
import {runPreparedDailyFactorCollection} from '../../../../lib/research/daily-factor-runner';
export const dynamic='force-dynamic';
export const maxDuration=120;
/** POST-only operator trigger; no cron schedule. Source-controlled policy defaults disabled. */
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};
 const authorized=authorizeCron(req);
 if(!authorized)return NextResponse.json({status:'unauthorized'},{status:401,headers});
 if(!DATA_ACTIVATION_POLICY.dailyInvocation)return NextResponse.json({status:'daily_collection_disabled'},{status:409,headers});
 // Fixed two-field request, bounded before parsing; approval is never taken from the request.
 const reader=req.body?.getReader();let text='';
 try{
  if(reader){let bytes=0;const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>512){await reader.cancel();return NextResponse.json({status:'request_too_large'},{status:413,headers});}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
  let input:unknown;try{input=JSON.parse(text);}catch{return NextResponse.json({status:'invalid_json'},{status:400,headers});}
  const result=await invokeApprovedDailyCollection(input,DATA_ACTIVATION_POLICY.dailyInvocation,{authorized,clock:()=>new Date(),
   preflight:()=>assertDataStorageReady(db(),'daily'),run:clock=>runPreparedDailyFactorCollection(db(),clock)});
  return NextResponse.json(result.body,{status:result.httpStatus,headers});
 }catch{return NextResponse.json({status:'daily_invocation_failed',retryAllowed:false,ordersAllowed:false},{status:503,headers});}
 finally{reader?.releaseLock();}
}
