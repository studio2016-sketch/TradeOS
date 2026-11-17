/** Strict assertion-only projection. Never return provider/model/graph values or dynamic keys. */
type ObjectValue=Record<string,any>;
const object=(x:unknown):x is ObjectValue=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
const array=(x:unknown):x is any[]=>Array.isArray(x);
const flag=(x:boolean)=>x?'PASS':'FAIL';
export const auditScopes=['sources','models','graph'] as const;
export type AuditScope=typeof auditScopes[number];
export function projectDetailedAudit(scope:AuditScope,data:Record<string,unknown>){
 const checks:Record<string,'PASS'|'FAIL'|'UNAVAILABLE'>={};
 function check(name:string,key:string,predicate:(value:ObjectValue)=>boolean){
  const value=data[key];checks[name]=!object(value)?'UNAVAILABLE':flag(predicate(value));
 }
 function availability(name:string,key:string,predicate:(value:ObjectValue)=>boolean){
  const value=data[key];checks[name]=object(value)&&predicate(value)?'PASS':'UNAVAILABLE';
 }
 if(scope==='sources'){
  availability('sourceObservationsPresent','extended',v=>array(v.checks)&&v.checks.some(x=>object(x)&&x.category!=='portfolio_metrics'&&['live','observed','timestamped_observation','computed_from_history','computed_from_timestamped_quotes','dated_observation'].includes(x.status)));
  availability('marketObservationsPresent','market',v=>array(v.snapshots)&&v.snapshots.some(x=>object(x)&&x.pricePresent===true));
  availability('historicalBarsPresent','market',v=>array(v.barChecks)&&v.barChecks.length===2&&v.barChecks.every(x=>object(x)&&x.status==='historical_data'&&Number.isInteger(x.count)&&x.count>0));
  check('sourceReportsStructured','extended',v=>array(v.checks)&&v.checks.length>0&&v.checks.every(x=>object(x)&&typeof x.category==='string'&&typeof x.source==='string'&&typeof x.status==='string'));
  check('brokerConfigurationDiagnosticPresent','extended',v=>array(v.checks)&&v.checks.some(x=>object(x)&&x.category==='portfolio_metrics'&&['read_access_configured_not_validated','read_access_not_authorized'].includes(x.status)));
  check('marketProbeStructured','market',v=>array(v.snapshots)&&['SPY','QQQ','NVDA'].every(s=>v.snapshots.some((x:any)=>object(x)&&x.symbol===s&&typeof x.state==='string'))&&array(v.barChecks)&&v.barChecks.length===2);
  check('marketCertificationNotClaimed','market',v=>v.productionCertification==='NOT_CERTIFIED'&&array(v.snapshots)&&v.snapshots.every(x=>object(x)&&x.exchangeRealtimeCertified===false));
  check('providerClockStructured','monitoring',v=>object(v.market)&&v.market.clockSource==='Alpaca Market Clock'&&typeof v.market.isOpen==='boolean'&&typeof v.market.clockTimestamp==='string'&&Number.isFinite(Date.parse(v.market.clockTimestamp))&&typeof v.market.nextOpen==='string'&&Number.isFinite(Date.parse(v.market.nextOpen)));
 }
 if(scope==='models'){
  availability('modelEvidencePresent','model',v=>array(v.validations)&&v.validations.some(x=>object(x)&&Number.isInteger(x.sampleCount)&&x.sampleCount>0));
  availability('factorEvidencePresent','factors',v=>array(v.associations)&&v.associations.some(x=>object(x)&&Number.isInteger(x.recorded)&&x.recorded>0));
  check('modelResearchOnly','model',v=>v.certification==='RESEARCH_ONLY_NOT_PROMOTED'&&array(v.validations));
  check('modelValidationShape','model',v=>array(v.validations)&&v.validations.every(x=>object(x)&&['RESEARCH_ONLY','INSUFFICIENT_EVIDENCE'].includes(x.status)&&Number.isInteger(x.sampleCount)&&x.sampleCount>=0&&typeof x.evidenceOfImprovement==='boolean'));
  check('provenanceCertificationBlocked','provenance',v=>v.certification==='BLOCKED_UNTIL_POINT_IN_TIME_SOURCE_AND_PAIRED_MODEL_EVIDENCE'&&object(v.audit));
  check('prospectiveTrialNotPromoted','trial',v=>v.status==='RESEARCH_ONLY'&&v.noAutomaticPromotion===true);
  check('factorValidationNotClaimed','factors',v=>v.status==='RESEARCH_ONLY'&&v.certified===false&&v.promotionAllowed===false&&array(v.associations)&&v.associations.every(x=>object(x)&&x.validated===false));
  check('historicalSimulationOnly','simulation',v=>v.certification==='RESEARCH_ONLY'&&object(v.simulation)&&v.simulation.mode==='HISTORICAL_PAPER_ONLY');
 }
 if(scope==='graph'){
  check('graphModeKnown','graph',v=>['RESEARCH_LINEAGE_ONLY','INDEPENDENT_SOURCE_GRAPH_ACTIVE'].includes(v.status));
  check('graphPredictiveAuthorityDenied','graph',v=>v.certifiedPredictiveRelationships===false);
  check('independentGraphPolicy','graph',v=>v.status==='RESEARCH_LINEAGE_ONLY'||(v.status==='INDEPENDENT_SOURCE_GRAPH_ACTIVE'&&object(v.independentGraph)&&object(v.independentGraph.policy)&&v.independentGraph.policy.graphImpliesPrediction===false&&v.independentGraph.policy.sourceCountMeansIndependentOriginFamilies===true&&v.independentGraph.policy.minimumIndependentSourcesForCertification===2&&array(v.independentGraph.edges)&&v.independentGraph.edges.every((x:any)=>object(x)&&x.predictiveAuthority===false)));
  check('corporateEvidenceProvenance','graph',v=>array(v.corporateRelationships)&&v.corporateRelationships.every(x=>object(x)&&typeof x.sourceUrl==='string'&&x.sourceUrl.length>0&&typeof x.verificationStatus==='string'&&x.verificationStatus.length>0&&typeof x.publishedAt==='string'&&Number.isFinite(Date.parse(x.publishedAt))));
  check('scientificPromotionDenied','certification',v=>v.modelPromotionAllowed===false&&v.liveExecutionAllowed===false);
  check('factorPromotionDenied','factors',v=>v.status==='RESEARCH_ONLY'&&v.certified===false&&v.promotionAllowed===false);
 }
 return {version:1,scope,checks,assurance:'ASSERTIONS_ONLY_NOT_SOURCE_OR_MODEL_CERTIFICATION'} as const;
}
export async function runDetailedAudit(scope:AuditScope,load:()=>Promise<Record<string,unknown>>,timeoutMs=55000){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{const result=await Promise.race([load(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})]);return projectDetailedAudit(scope,result??{});}
 catch{return projectDetailedAudit(scope,{});}finally{if(timer)clearTimeout(timer);}
}
