"""Validate assertion-only fixed schemas; never log raw private reports or HTTP errors."""
import json, os, re, sys, urllib.request, urllib.error
BASE='https://tradeos-lac.vercel.app'
CHECKS={
 'readiness':{'officialClockFresh','closedMarketNextOpenFuture','brokerReadConfigurationObserved','brokerAccountReadConfigured'},
 'advancement':{'officialSessionOpen','observationIntervalElapsed','spyObservationAdvanced','qqqObservationAdvanced','historicalChartPresent'},
 'sources':{'sourceObservationsPresent','marketObservationsPresent','historicalBarsPresent','sourceReportsStructured','brokerConfigurationDiagnosticPresent','marketProbeStructured','marketCertificationNotClaimed','providerClockStructured'},
 'models':{'modelEvidencePresent','factorEvidencePresent','modelResearchOnly','modelValidationShape','provenanceCertificationBlocked','prospectiveTrialNotPromoted','factorValidationNotClaimed','historicalSimulationOnly'},
 'graph':{'graphModeKnown','graphPredictiveAuthorityDenied','independentGraphPolicy','corporateEvidenceProvenance','scientificPromotionDenied','factorPromotionDenied'},
}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None

def verify(scope,open_url):
 if scope not in CHECKS: raise RuntimeError('invalid scope')
 token=os.environ.get('TRADEOS_RUNTIME_AUDIT_TOKEN','')
 if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' if os.environ.get('TRADEOS_RUNTIME_AUDIT_AUTH_MODE')=='github-oidc' else r'[a-f0-9]{64}',token): raise RuntimeError('audit credential unavailable')
 # Never send audit capability to account or research APIs.
 for path in ['/api/forecasts','/api/broker-state','/api/private-portfolio-reconciliation','/api/private-broker-activity-audit']:
  try:
   with open_url(urllib.request.Request(BASE+path),timeout=15): raise RuntimeError('anonymous access not denied')
  except urllib.error.HTTPError as error:
   if error.code!=401: raise RuntimeError('anonymous denial unavailable') from None
 endpoint='/api/private-market-audit' if scope in {'readiness','advancement'} else '/api/private-detailed-audit'
 assurance='OBSERVATION_CHECK_ONLY_NOT_FEED_OR_MODEL_CERTIFICATION' if scope in {'readiness','advancement'} else 'ASSERTIONS_ONLY_NOT_SOURCE_OR_MODEL_CERTIFICATION'
 request=urllib.request.Request(BASE+endpoint+'?scope='+scope,headers={'Authorization':'Bearer '+token})
 try: response=open_url(request,timeout=170 if scope=='advancement' else 60)
 except urllib.error.HTTPError as error:
  if error.code!=503: raise RuntimeError('audit response unavailable') from None
  response=error
 with response:
  if response.status not in {200,503}: raise RuntimeError('unexpected HTTP status')
  raw=response.read(4097)
  if len(raw)>4096: raise RuntimeError('unexpected audit size')
  report=json.loads(raw)
 if type(report) is not dict or set(report)!={'version','scope','checks','assurance'} or type(report['version']) is not int or report['version']!=1 or report['scope']!=scope or report['assurance']!=assurance: raise RuntimeError('unexpected audit schema')
 checks=report['checks']
 if type(checks) is not dict or set(checks)!=CHECKS[scope] or any(type(value) is not str or value not in ({'PASS','FAIL','UNAVAILABLE','NOT_RUN_MARKET_CLOSED'} if scope=='advancement' else {'PASS','FAIL','UNAVAILABLE'}) for value in checks.values()): raise RuntimeError('unexpected checks')
 skipped=scope=='advancement' and all(value=='NOT_RUN_MARKET_CLOSED' for value in checks.values())
 if any(value=='NOT_RUN_MARKET_CLOSED' for value in checks.values()) and not skipped: raise RuntimeError('inconsistent skip')
 if response.status==200 and not skipped and any(value!='PASS' for value in checks.values()): raise RuntimeError('inconsistent success')
 if response.status==503 and (skipped or all(value=='PASS' for value in checks.values())): raise RuntimeError('inconsistent unavailable')
 return checks
if __name__=='__main__':
 try:
  checks=verify(sys.argv[1] if len(sys.argv)==2 else '',urllib.request.build_opener(NoRedirect()).open)
  for key,value in sorted(checks.items()): print(key+': '+value)
  print('Assertions only. No source freshness, profitability or predictive certification inferred.')
  if all(value=='NOT_RUN_MARKET_CLOSED' for value in checks.values()):
   print('NOT RUN: verified official market closure; advancing observations were not tested.')
   sys.exit(0)
  sys.exit(0 if all(value=='PASS' for value in checks.values()) else 1)
 except Exception:
  print('FAIL: detailed audit incomplete; private payload and exception details suppressed.',file=sys.stderr)
  sys.exit(1)
