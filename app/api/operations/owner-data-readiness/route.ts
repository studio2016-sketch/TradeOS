import {NextResponse} from 'next/server';
import {auth} from '../../../../lib/auth/server';
import {db} from '../../../../lib/db';
import {alpacaDailyHistory} from '../../../../lib/research/market-factor-history';
import {dataReadinessDiagnostic,readOnlyDiagnosticSql} from '../../../../lib/research/data-readiness-diagnostic';
import {OWNER_DIAGNOSTIC_WINDOW,ownerDiagnosticRequest,verifiedDiagnosticOwner,boundedOwnerSession,emptyOwnerDiagnosticBody} from '../../../../lib/research/owner-data-diagnostic';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){
 const deadline=Date.now()+55000,signal=AbortSignal.timeout(55000);
 const headers={'Cache-Control':'private, no-store'};
 const status=ownerDiagnosticRequest(req,OWNER_DIAGNOSTIC_WINDOW,new Date());
 if(status!==200)return NextResponse.json({status:'owner_diagnostic_not_permitted'},{status,headers});
 if(!await emptyOwnerDiagnosticBody(req))return NextResponse.json({status:'owner_diagnostic_not_permitted'},{status:400,headers});
 try{
  const session=await boundedOwnerSession(()=>auth.getSession());
  const sql=readOnlyDiagnosticSql(db(),signal);
  if(!await verifiedDiagnosticOwner(session.data?.user?.id,process.env.TRADEOS_OWNER_USER_ID,sql))return NextResponse.json({status:'verified_owner_required'},{status:403,headers});
  // Session/role lookup can consume time; recheck the entire route budget before providers.
  if(ownerDiagnosticRequest(req,OWNER_DIAGNOSTIC_WINDOW,new Date())!==200)return NextResponse.json({status:'owner_diagnostic_window_closed'},{status:409,headers});
  const result=await dataReadinessDiagnostic({sql,deadline,feed:process.env.ALPACA_FEED||'iex',clock:()=>new Date(),history:alpacaDailyHistory});
  return NextResponse.json(result,{headers});
 }catch{return NextResponse.json({status:'diagnostic_unavailable',persistentWrites:false,collectionEnabled:false,executionAllowed:false},{status:503,headers});}
}
