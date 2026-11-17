import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';
test('OIDC acquisition enforces Github destination, audience, bounds, no redirects and no subprocess secret inheritance',()=>{
 const r=spawnSync('python3',['-c',`
import importlib.util,json,os,urllib.parse
spec=importlib.util.spec_from_file_location('oidc','scripts/run-private-oidc-audit.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class R:
 status=200
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def read(self,n):return json.dumps({'value':'aaa.bbb.ccc'}).encode()
def open_url(req,**kw):
 assert req.get_header('Authorization')=='Bearer ISSUER-SECRET'
 u=urllib.parse.urlsplit(req.full_url)
 assert u.hostname=='pipelines.actions.githubusercontent.com'
 assert urllib.parse.parse_qs(u.query)['audience']==[m.AUDIENCE]
 assert kw['timeout']==10
 return R()
env={'ACTIONS_ID_TOKEN_REQUEST_URL':'https://pipelines.actions.githubusercontent.com/path?api-version=1&audience=old','ACTIONS_ID_TOKEN_REQUEST_TOKEN':'ISSUER-SECRET'}
assert m.acquire(open_url,env)=='aaa.bbb.ccc'
for bad in ['http://pipelines.actions.githubusercontent.com/a','https://evil.invalid/a','https://pipelines.actions.githubusercontent.com.evil.invalid/a','https://evil@pipelines.actions.githubusercontent.com/a','https://pipelines.actions.githubusercontent.com:123/a','https://pipelines.actions.githubusercontent.com/a#frag','']:
 try:m.acquire(lambda *a,**kw:(_ for _ in ()).throw(AssertionError('network')),dict(env,ACTIONS_ID_TOKEN_REQUEST_URL=bad));raise AssertionError('unsafe URL')
 except ValueError:pass
assert m.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.invalid') is None
os.environ.update(env)
m.acquire=lambda *a:'aaa.bbb.ccc'
class P:returncode=0
def run(args,env,check):
 assert args==[m.sys.executable,'scripts/verify-private-detailed.py','graph']
 assert env['TRADEOS_RUNTIME_AUDIT_TOKEN']=='aaa.bbb.ccc'
 assert env['TRADEOS_RUNTIME_AUDIT_AUTH_MODE']=='github-oidc'
 assert 'ACTIONS_ID_TOKEN_REQUEST_TOKEN' not in env
 assert 'ACTIONS_ID_TOKEN_REQUEST_URL' not in env
 assert not check
 return P()
m.subprocess.run=run
assert m.main('graph')==0
try:m.main('owner');raise AssertionError('scope')
except ValueError:pass
`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
});
test('OIDC jobs are main-only, no PR events, no stored secrets and fixed scopes',()=>{
 for(const [file,scope] of [['private-runtime-audit','heartbeat'],['extended-production-audit','sources'],['model-runtime-audit','models'],['knowledge-graph-production','graph'],['broker-clock-readiness','readiness'],['market-hours-advance','advancement']]){
 const s=readFileSync('.github/workflows/'+file+'.yml','utf8');assert.match(s,/id-token: write/);assert.match(s,/if: github.ref == 'refs\/heads\/main'/);assert.ok(!s.includes('pull_request'));assert.ok(!s.includes('secrets.'));assert.ok(!s.includes('environment:'));assert.ok(s.includes('scripts/run-private-oidc-audit.py '+scope));assert.match(s,/persist-credentials: false/);
 }
});
