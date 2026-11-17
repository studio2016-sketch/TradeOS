"""Fail-closed, no-response-body logging. Fixed-origin read-only scheduled check."""
import json, os, re, sys, urllib.request, urllib.error
BASE = 'https://tradeos-lac.vercel.app'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def check(open_url):
    token = os.environ.get('TRADEOS_RUNTIME_AUDIT_TOKEN', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' if os.environ.get('TRADEOS_RUNTIME_AUDIT_AUTH_MODE')=='github-oidc' else r'[a-f0-9]{64}', token):
        raise RuntimeError('Audit credential is missing or invalid; no checks ran')
    # Anonymous check is deliberately separate and never receives the token.
    for path in ['/api/forecasts', '/api/research', '/api/alignment', '/api/research-certification']:
        try:
            with open_url(urllib.request.Request(BASE+path), timeout=15):
                raise RuntimeError('Anonymous boundary check failed')
        except urllib.error.HTTPError as error:
            if error.code != 401:
                raise RuntimeError('Anonymous boundary did not return required denial') from None
    request = urllib.request.Request(BASE+'/api/private-runtime-audit', headers={'Authorization':'Bearer '+token})
    try:
        with open_url(request, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError('Authenticated runtime probe unavailable')
            raw=response.read(4097)
            if len(raw)>4096:
                raise RuntimeError('Unexpected audit response size')
            report=json.loads(raw)
    except Exception:
        raise RuntimeError('Authenticated runtime probe unavailable') from None
    expected={'version','databaseReachable','ingestionObservedWithin12Minutes','researchObservedWithin40Minutes','scope','marketFreshnessCertified','modelValidated','ownerSessionVerified'}
    if not isinstance(report,dict) or set(report)!=expected or type(report['version']) is not int or report['version']!=1 or report['scope']!='CONNECTIVITY_AND_STORED_HEARTBEATS_ONLY':
        raise RuntimeError('Unexpected audit schema')
    if any(type(report[key]) is not bool for key in expected-{'version','scope'}):
        raise RuntimeError('Invalid audit flags')
    if report['databaseReachable'] is not True or any(report[key] for key in ['marketFreshnessCertified','modelValidated','ownerSessionVerified']):
        raise RuntimeError('Invalid audit assurance')
    return report

if __name__=='__main__':
    try:
        report=check(urllib.request.build_opener(NoRedirect()).open)
        print('PASS: anonymous denial and scoped database connectivity only.')
        print('Recent ingestion heartbeat:', report['ingestionObservedWithin12Minutes'])
        print('Recent research heartbeat:', report['researchObservedWithin40Minutes'])
        print('NOT VERIFIED: owner session, source freshness, model validity, historical model/graph audits and browser flows.')
    except Exception:
        print('FAIL: private runtime audit incomplete; no research response or exception details logged.',file=sys.stderr)
        sys.exit(1)
