import {assertDataStorageReady} from './data-storage-readiness';
import {dailyCollectionPlan,dailySymbolEvidence,DAILY_SYMBOLS,DAILY_KEYS} from './daily-factor-collection';
import {DAILY_HISTORY_TIMEOUT_MS,type HistoryResult} from './market-factor-history';

/** Every query uses the application's connection under a database-enforced read-only transaction.
 * No persistent locks, claims, evidence, receipts or permission changes are made.
 */
export function readOnlyDiagnosticSql(sql:any,signal:AbortSignal){
 return async(s:TemplateStringsArray,...v:unknown[])=>{
  const result=await sql.transaction([sql(s,...v)],{readOnly:true,fetchOptions:{signal}});
  return result[0];
 };
}
export async function dataReadinessDiagnostic(deps:{sql:any;feed:string;deadline?:number;clock:()=>Date;history:(symbol:string,asOf:string,session:string)=>Promise<HistoryResult>}){
 if(deps.feed!=='iex')throw Error('diagnostic_requires_iex');
 const started=deps.clock(),plan=dailyCollectionPlan(started),deadline=Math.min(+started+55000,deps.deadline??Infinity);let previous=+started;
 const checkClock=()=>{const now=deps.clock();if(!Number.isFinite(+now)||+now<previous||(!Number.isFinite(deadline)||+now>=deadline)||dailyCollectionPlan(now).session!==plan.session)throw Error('diagnostic_clock_or_deadline');previous=+now;return now;};
 // Reserve the complete provider timeout plus three seconds for validation/serialization.
 const requireProviderBudget=()=>{const now=checkClock();if(+now+DAILY_HISTORY_TIMEOUT_MS+3000>deadline)throw Error('diagnostic_provider_budget');};
 const identity=await deps.sql`select current_user as runtime_role,current_database() as database,current_setting('transaction_read_only') as read_only`;
 if(identity[0]?.read_only!=='on'||typeof identity[0]?.runtime_role!=='string'||typeof identity[0]?.database!=='string')throw Error('diagnostic_read_only_required');
 const storage:Record<string,{ready:boolean}>={};
 for(const kind of ['exact','daily'] as const){
  checkClock();try{await assertDataStorageReady(deps.sql,kind);storage[kind]={ready:true};}catch{storage[kind]={ready:false};}
 }
 const histories=[];
 for(let i=0;i<DAILY_SYMBOLS.length;i+=2){
  requireProviderBudget();
  const batch=await Promise.all(DAILY_SYMBOLS.slice(i,i+2).map(async symbol=>{
   requireProviderBudget();
   let history:HistoryResult;try{history=await deps.history(symbol,started.toISOString(),plan.session);}catch{history={source:'Alpaca:iex',bars:[],error:'fetch_failed'};}
   const received=checkClock();
   // Provider error text and bars never leave this diagnostic. Reuse the collector's validation/calculation.
   if(history.error)return {symbol,ready:false,reason:'history_unavailable',retrievedAt:received.toISOString()};
   const result=dailySymbolEvidence(symbol,history,plan);
   const ready=history.bars.length>=200&&result.evidence.length===DAILY_KEYS.length;
   return {symbol,ready,reason:ready?'complete_raw_window':'history_validation_or_coverage_failed',source:history.source==='Alpaca:iex'?'Alpaca:iex':'unsupported',barCount:history.bars.length,
    calculationWindow:200,factorCount:result.evidence.length,retrievedAt:received.toISOString()};
  }));histories.push(...batch);
 }
 const finished=checkClock();
 return {status:storage.exact.ready&&storage.daily.ready&&histories.every(h=>h.ready)?'ready_for_activation_review':'blocked',
  runtime:{role:identity[0].runtime_role,database:identity[0].database,readOnly:true},storage,histories,
  session:plan.session,startedAt:started.toISOString(),finishedAt:finished.toISOString(),feed:'Alpaca:iex',adjustment:'raw',
  limits:{requests:3,concurrency:2,retries:0,pagination:false},persistentWrites:false,collectionEnabled:false,scientificallyCertified:false,executionAllowed:false};
}
