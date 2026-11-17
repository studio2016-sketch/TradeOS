import {NextResponse} from 'next/server';
import {authorizeCron} from '../../../../lib/cron';
import {db} from '../../../../lib/db';
import {alpacaDailyHistory} from '../../../../lib/research/market-factor-history';
import {dataReadinessDiagnostic,readOnlyDiagnosticSql} from '../../../../lib/research/data-readiness-diagnostic';
export const dynamic='force-dynamic';
export const maxDuration=60;
/** Operator-only, read-only, fixed scope. No GET, schedule, caller parameters or secret output. */
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};
 if(!authorizeCron(req))return NextResponse.json({status:'unauthorized'},{status:401,headers});
 if(new URL(req.url).search||req.body!==null)return NextResponse.json({status:'parameters_not_supported'},{status:400,headers});
 try{
  const result=await dataReadinessDiagnostic({sql:readOnlyDiagnosticSql(db(),AbortSignal.timeout(55000)),feed:process.env.ALPACA_FEED||'iex',clock:()=>new Date(),history:alpacaDailyHistory});
  return NextResponse.json(result,{headers});
 }catch{return NextResponse.json({status:'diagnostic_unavailable',persistentWrites:false,collectionEnabled:false,executionAllowed:false},{status:503,headers});}
}
