import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('runtime runner never forwards credentials on anonymous calls and does not accept private output',()=>{
 const result=spawnSync('python3',['-c',`
import importlib.util,json,os,urllib.error
spec=importlib.util.spec_from_file_location('audit','scripts/verify-private-runtime.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
os.environ['TRADEOS_RUNTIME_AUDIT_TOKEN']='ab'*32
class Response:
 status=200
 def __init__(self,report): self.report=report
 def __enter__(self): return self
 def __exit__(self,*a): pass
 def read(self,n): return json.dumps(self.report).encode()[:n]
report={'version':1,'databaseReachable':True,'ingestionObservedWithin12Minutes':False,'researchObservedWithin40Minutes':False,'scope':'CONNECTIVITY_AND_STORED_HEARTBEATS_ONLY','marketFreshnessCertified':False,'modelValidated':False,'ownerSessionVerified':False}
calls=[]
def opener(req,**kwargs):
 calls.append(req)
 assert req.full_url.startswith(m.BASE+'/api/')
 if req.full_url.endswith('/private-runtime-audit'):
  assert req.get_header('Authorization')=='Bearer '+'ab'*32
  return Response(report)
 assert req.get_header('Authorization') is None
 raise urllib.error.HTTPError(req.full_url,401,'denied',{},None)
assert m.check(opener)==report
assert len(calls)==5
report['private_equity']=999
try: m.check(opener);raise AssertionError('leak accepted')
except RuntimeError: pass
assert m.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.invalid') is None
os.environ['TRADEOS_RUNTIME_AUDIT_TOKEN']=''
try: m.check(lambda *a,**kw: (_ for _ in ()).throw(AssertionError('network called')));raise AssertionError('missing credential accepted')
except RuntimeError: pass
`],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
