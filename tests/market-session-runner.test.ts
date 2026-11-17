import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('runner preserves explicit market-closed skip and rejects partial skip/missing symbol checks',()=>{
 const r=spawnSync('python3',['-c',`
import importlib.util,json,os,urllib.error
spec=importlib.util.spec_from_file_location('audit','scripts/verify-private-detailed.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);os.environ['TRADEOS_RUNTIME_AUDIT_TOKEN']='ab'*32
report={'version':1,'scope':'advancement','checks':{k:'NOT_RUN_MARKET_CLOSED' for k in m.CHECKS['advancement']},'assurance':'OBSERVATION_CHECK_ONLY_NOT_FEED_OR_MODEL_CERTIFICATION'}
class R:
 status=200
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return json.dumps(report).encode()[:n]
def opener(req,**kwargs):
 if '/private-market-audit?' in req.full_url:
  assert kwargs['timeout']==170
  assert req.full_url==m.BASE+'/api/private-market-audit?scope=advancement'
  return R()
 assert req.get_header('Authorization') is None
 raise urllib.error.HTTPError(req.full_url,401,'denied',{},None)
assert all(x=='NOT_RUN_MARKET_CLOSED' for x in m.verify('advancement',opener).values())
report['checks']['spyObservationAdvanced']='PASS'
try:m.verify('advancement',opener);raise AssertionError('partial skip accepted')
except RuntimeError:pass
report['checks']={k:'PASS' for k in m.CHECKS['advancement']};del report['checks']['qqqObservationAdvanced']
try:m.verify('advancement',opener);raise AssertionError('missing QQQ accepted')
except RuntimeError:pass
`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
