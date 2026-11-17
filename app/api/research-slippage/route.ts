import {NextResponse} from 'next/server';
import {auth} from '../../../lib/auth/server';
import {db,hasDatabase} from '../../../lib/db';
import {evidenceTimestamp} from '../../../lib/research/evidence-time';
import {readSlippageAtDecisionWithSql} from '../../../lib/research/slippage-coverage-reader';
export const dynamic='force-dynamic';
/** Owner-only descriptive point-in-time lookup. Does not change any outcome consumer. */
export async function GET(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:'Verified owner session required'},{status:403,headers});
  const sql=db(),owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=='admin'||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:'Verified owner session required'},{status:403,headers});
  const params=new URL(req.url).searchParams,symbol=params.get('symbol')??'SPY',now=new Date().toISOString(),at=params.get('at')??now;
  const cutoff=evidenceTimestamp(at);
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)||cutoff===null||cutoff>evidenceTimestamp(now)!)return NextResponse.json({error:'Invalid symbol or decision time'},{status:400,headers});
  const evidence=await readSlippageAtDecisionWithSql(sql,symbol,at);
  return NextResponse.json({status:evidence?'OBSERVED_NOT_CERTIFIED':'UNAVAILABLE',symbol,decisionTime:at,evidence,
   storageScope:'legacy_microseconds_and_optional_exact_nanoseconds',certified:false,ordersAllowed:false,
   warning:'Quoted half-spread research evidence, not realized slippage, current executable liquidity or independently verified source timing.'},{headers});
 }catch{return NextResponse.json({error:'Slippage evidence unavailable'},{status:503,headers});}
}
