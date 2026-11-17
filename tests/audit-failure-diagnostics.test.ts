import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('audit runners classify HTTP auth denial and transport failures without error/body leakage',()=>{
 const r=spawnSync('python3',['-c',`
import importlib.util,urllib.error,os
os.environ['TRADEOS_RUNTIME_AUDIT_TOKEN']='ab'*32
for file in ['verify-private-runtime','verify-private-detailed']:
 spec=importlib.util.spec_from_file_location('audit','scripts/'+file+'.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 assert m.failure_code(RuntimeError('PRIVATE-CANARY'))=='audit_incomplete'
 e=m.AuditFailure('PRIVATE-CANARY');assert m.failure_code(e)=='audit_incomplete'
 e.code='PRIVATE-CANARY';assert m.failure_code(e)=='audit_incomplete'
 def run(opener):return m.check(opener) if file=='verify-private-runtime' else m.verify('readiness',opener)
 for status in [401,403,404,429,500,502]:
  def opener(req,**kw):
   if '/api/private-runtime-audit' in req.full_url or '/api/private-market-audit' in req.full_url:raise urllib.error.HTTPError(req.full_url,status,'PRIVATE-CANARY',{},None)
   raise urllib.error.HTTPError(req.full_url,401,'PRIVATE-CANARY',{},None)
  try:run(opener);raise AssertionError('failure accepted')
  except m.AuditFailure as e:assert m.failure_code(e)==('audit_auth_denied' if status in [401,403] else 'audit_http_unavailable')
 def timeout(req,**kw):
  if '/api/private-runtime-audit' in req.full_url or '/api/private-market-audit' in req.full_url:raise urllib.error.URLError('PRIVATE-CANARY')
  raise urllib.error.HTTPError(req.full_url,401,'PRIVATE-CANARY',{},None)
 try:run(timeout);raise AssertionError('timeout accepted')
 except m.AuditFailure as e:assert m.failure_code(e)=='audit_transport_unavailable'
`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
});
test('server denial logging is bounded per fixed category per minute',async()=>{
 const {createAuditDenialReporter}=await import('../lib/auth/audit-denial-diagnostics');let time=1;const lines:string[][]=[];
 const report=createAuditDenialReporter((a,b)=>lines.push([a,b]),()=>time);
 for(let i=0;i<100;i++)report('token_shape');report('identity');assert.equal(lines.length,2);
 time+=59999;report('token_shape');assert.equal(lines.length,2);
 time++;report('token_shape');assert.equal(lines.length,3);
 assert.deepEqual(lines,[['TRADEOS_AUDIT_AUTH_DENIED','token_shape'],['TRADEOS_AUDIT_AUTH_DENIED','identity'],['TRADEOS_AUDIT_AUTH_DENIED','token_shape']]);
});
