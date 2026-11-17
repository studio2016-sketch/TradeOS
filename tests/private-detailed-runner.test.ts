import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('detailed runner enforces exact fixed checks and never sends capability to account APIs',()=>{
 const result=spawnSync('python3',['-c',`
import importlib.util,json,os,urllib.error
spec=importlib.util.spec_from_file_location('audit','scripts/verify-private-detailed.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
os.environ['TRADEOS_RUNTIME_AUDIT_TOKEN']='ab'*32
class Response:
 status=200
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return json.dumps(report).encode()[:n]
report={'version':1,'scope':'graph','checks':{k:'PASS' for k in m.CHECKS['graph']},'assurance':'ASSERTIONS_ONLY_NOT_SOURCE_OR_MODEL_CERTIFICATION'}
def opener(req,**kwargs):
 if '/private-detailed-audit?' in req.full_url:
  assert req.full_url==m.BASE+'/api/private-detailed-audit?scope=graph'
  assert req.get_header('Authorization')=='Bearer '+'ab'*32
  return Response()
 assert req.get_header('Authorization') is None
 raise urllib.error.HTTPError(req.full_url,401,'denied',{},None)
assert set(m.verify('graph',opener))==m.CHECKS['graph']
Response.status=201
try:m.verify('graph',opener);raise AssertionError('unexpected HTTP status accepted')
except RuntimeError:pass
Response.status=200
report['checks']['SECRET-CANARY']='PASS'
try:m.verify('graph',opener);raise AssertionError('unexpected private field accepted')
except RuntimeError:pass
report['checks'].pop('SECRET-CANARY')
report['checks']['graphModeKnown']='FAIL'
try:m.verify('graph',opener);raise AssertionError('inconsistent HTTP success accepted')
except RuntimeError:pass
assert m.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.invalid') is None
try:m.verify('https://evil.invalid',opener);raise AssertionError('arbitrary destination accepted')
except RuntimeError:pass
`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
