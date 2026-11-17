"""Obtain an ephemeral GitHub OIDC token, keep it in process memory, run fixed audit."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
AUDIENCE='https://tradeos-lac.vercel.app/private-audit'
SCOPES={'heartbeat','sources','models','graph','readiness','advancement'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None

def acquire(open_url,env):
 url=urllib.parse.urlsplit(env.get('ACTIONS_ID_TOKEN_REQUEST_URL',''))
 bearer=env.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN','')
 if url.scheme!='https' or not url.hostname or not url.hostname.endswith('.actions.githubusercontent.com') or url.port not in (None,443) or url.username or url.password or url.fragment or not bearer:
  raise ValueError('OIDC unavailable')
 query=urllib.parse.parse_qsl(url.query,keep_blank_values=True)
 query=[(k,v) for k,v in query if k!='audience']+[('audience',AUDIENCE)]
 target=urllib.parse.urlunsplit(url._replace(query=urllib.parse.urlencode(query)))
 with open_url(urllib.request.Request(target,headers={'Authorization':'Bearer '+bearer}),timeout=10) as response:
  if response.status!=200: raise ValueError('OIDC unavailable')
  raw=response.read(32769)
  if len(raw)>32768: raise ValueError('OIDC unavailable')
  token=json.loads(raw).get('value')
 if not isinstance(token,str) or len(token)>16377 or not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',token):
  raise ValueError('OIDC unavailable')
 return token

def main(scope):
 if scope not in SCOPES: raise ValueError('invalid scope')
 # No shell, command-line token, GITHUB_ENV file, artifact, token decode or token print.
 token=acquire(urllib.request.build_opener(NoRedirect()).open,os.environ)
 child=os.environ.copy()
 child.pop('ACTIONS_ID_TOKEN_REQUEST_TOKEN',None)
 child.pop('ACTIONS_ID_TOKEN_REQUEST_URL',None)
 child['TRADEOS_RUNTIME_AUDIT_TOKEN']=token
 child['TRADEOS_RUNTIME_AUDIT_AUTH_MODE']='github-oidc'
 args=[sys.executable,'scripts/verify-private-runtime.py'] if scope=='heartbeat' else [sys.executable,'scripts/verify-private-detailed.py',scope]
 return subprocess.run(args,env=child,check=False).returncode
if __name__=='__main__':
 try: sys.exit(main(sys.argv[1] if len(sys.argv)==2 else ''))
 except Exception:
  print('FAIL: OIDC audit unavailable; token and response details suppressed.',file=sys.stderr)
  sys.exit(1)
