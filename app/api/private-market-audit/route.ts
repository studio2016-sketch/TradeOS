import {authorizeRuntimeAudit} from '../../../lib/auth/scoped-runtime-audit';
import {runSessionAudit,type SessionScope} from '../../../lib/operations/market-session-audit';
export const dynamic='force-dynamic';
export const maxDuration=180;
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
export async function GET(request:Request){
 const status=await authorizeRuntimeAudit(request);if(status!==200)return Response.json({error:'runtime_audit_unavailable'},{status,headers});
 const params=new URL(request.url).searchParams,scope=params.get('scope') as SessionScope;
 if(params.size!==1||!['readiness','advancement'].includes(scope))return Response.json({error:'invalid_audit_scope'},{status:400,headers});
 const report=await runSessionAudit(scope,{
  clock:async()=>{const m=await import('../../../lib/operations/strict-provider-clock');return m.readStrictProviderClock();},
  brokerConfigured:async()=>{const m=await import('../../../lib/broker/alpaca');return m.brokerReadStatus().enabled;},
  market:async()=>{const m=await import('../../../lib/operations/internal-audit-models/market');const r=await m.privateGET(new Request('https://internal.invalid/api/market?symbols=SPY,QQQ'));return r.ok?r.json():null;},
  chart:async()=>{const m=await import('../../../lib/operations/internal-audit-models/chart');const r=await m.privateGET(new Request('https://internal.invalid/api/chart?symbol=SPY&minutes=480&timeframe=5Min'));return r.ok?r.json():null;},
  now:Date.now,wait:ms=>new Promise(resolve=>setTimeout(resolve,ms))
 });
 const values=Object.values(report.checks);return Response.json(report,{status:values.every(x=>x==='PASS')||values.every(x=>x==='NOT_RUN_MARKET_CLOSED')?200:503,headers});
}
