import {authorizeRuntimeAudit} from '../../../lib/auth/scoped-runtime-audit';
import {auditScopes,runDetailedAudit,type AuditScope} from '../../../lib/operations/detailed-audit';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
export async function GET(request:Request){
 const status=await authorizeRuntimeAudit(request);
 if(status!==200)return Response.json({error:'runtime_audit_unavailable'},{status,headers});
 const params=new URL(request.url).searchParams;
 const scope=params.get('scope') as AuditScope;
 if(params.size!==1||!auditScopes.includes(scope))return Response.json({error:'invalid_audit_scope'},{status:400,headers});
 const report=await runDetailedAudit(scope,async()=>{
  // Fixed module/input lists, never a caller-selected API URL or module path.
  async function read(run:()=>Promise<Response>){try{const r=await run();return r.ok?await r.json():null;}catch{return null;}}
  if(scope==='sources'){
   const [extended,market,monitoring]=await Promise.all([
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/extended-source-audit');return m.privateGET();}),
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/source-audit');return m.privateGET();}),
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/monitoring-status');return m.privateGET();})]);
   return {extended,market,monitoring};
  }
  if(scope==='graph'){
   const [graph,certification,factors]=await Promise.all([
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/knowledge-graph');return m.privateGET(new Request('https://internal.invalid/api/knowledge-graph?symbol=NVDA'));}),
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/research-certification');return m.privateGET();}),
    read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/factor-lab');return m.privateGET(new Request('https://internal.invalid/api/factor-lab'));})]);
   return {graph,certification,factors};
  }
  const [model,provenance,trial,factors,simulation]=await Promise.all([
   read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/model-validation');return m.privateGET(new Request('https://internal.invalid/api/model-validation'));}),
   read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/forecast-provenance');return m.privateGET();}),
   read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/prospective-trial');return m.privateGET();}),
   read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/factor-lab');return m.privateGET(new Request('https://internal.invalid/api/factor-lab'));}),
   read(async()=>{const m=await import('../../../lib/operations/internal-audit-models/replay-simulation');return m.privateGET(new Request('https://internal.invalid/api/replay-simulation?symbol=AAPL&decisionAt=2026-10-16T15%3A00%3A00Z&equity=10000&risk=100&stopPct=2&targetPct=3&bars=20'));})]);
  return {model,provenance,trial,factors,simulation};
 });
 return Response.json(report,{status:Object.values(report.checks).every(x=>x==='PASS')?200:503,headers});
}
