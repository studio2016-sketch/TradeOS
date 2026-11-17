"""Fail-closed, no-response-body logging. Fixed-origin read-only scheduled check."""
import json, os, re, sys, urllib.request, urllib.error
BASE = 'https://tradeos-lac.vercel.app'

FAILURE_CODES = frozenset({'credential_unavailable','boundary_not_denied','audit_auth_denied','audit_http_unavailable','audit_transport_unavailable','audit_schema_invalid','invalid_scope'})
class AuditFailure(RuntimeError):
    def __init__(self, code):
        self.code = code if code in FAILURE_CODES else 'audit_incomplete'
        super().__init__(self.code)

def failure_code(error):
    return error.code if isinstance(error, AuditFailure) and error.code in FAILURE_CODES else 'audit_incomplete'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def check(open_url):
    token = os.environ.get('TRADEOS_RUNTIME_AUDIT_TOKEN', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' if os.environ.get('TRADEOS_RUNTIME_AUDIT_AUTH_MODE')=='github-oidc' else r'[a-f0-9]{64}', token):
        raise AuditFailure('credential_unavailable')
    # Anonymous check is deliberately separate and never receives the token.
    for path in ['/api/forecasts', '/api/research', '/api/alignment', '/api/research-certification']:
        try:
            with open_url(urllib.request.Request(BASE+path), timeout=15):
                raise AuditFailure('boundary_not_denied')
        except urllib.error.HTTPError as error:
            if error.code != 401:
                raise AuditFailure('boundary_not_denied') from None
    request = urllib.request.Request(BASE+'/api/private-runtime-audit', headers={'Authorization':'Bearer '+token})
    try:
        with open_url(request, timeout=20) as response:
            if response.status != 200:
                raise AuditFailure('audit_transport_unavailable')
            raw=response.read(4097)
            if len(raw)>4096:
                raise AuditFailure('audit_schema_invalid')
            report=json.loads(raw)
    except urllib.error.HTTPError as error:
        raise AuditFailure('audit_auth_denied' if error.code in {401,403} else 'audit_http_unavailable') from None
    except AuditFailure:
        raise
    except Exception:
        raise AuditFailure('audit_transport_unavailable') from None
    expected={'version','databaseReachable','ingestionObservedWithin12Minutes','researchObservedWithin40Minutes','scope','marketFreshnessCertified','modelValidated','ownerSessionVerified'}
    if not isinstance(report,dict) or set(report)!=expected or type(report['version']) is not int or report['version']!=1 or report['scope']!='CONNECTIVITY_AND_STORED_HEARTBEATS_ONLY':
        raise AuditFailure('audit_schema_invalid')
    if any(type(report[key]) is not bool for key in expected-{'version','scope'}):
        raise AuditFailure('audit_schema_invalid')
    if report['databaseReachable'] is not True or any(report[key] for key in ['marketFreshnessCertified','modelValidated','ownerSessionVerified']):
        raise AuditFailure('audit_schema_invalid')
    return report

if __name__=='__main__':
    try:
        report=check(urllib.request.build_opener(NoRedirect()).open)
        print('PASS: anonymous denial and scoped database connectivity only.')
        print('Recent ingestion heartbeat:', report['ingestionObservedWithin12Minutes'])
        print('Recent research heartbeat:', report['researchObservedWithin40Minutes'])
        print('NOT VERIFIED: owner session, source freshness, model validity, historical model/graph audits and browser flows.')
    except Exception as error:
        print('FAIL: '+failure_code(error)+'; no research response or exception details logged.',file=sys.stderr)
        sys.exit(1)
