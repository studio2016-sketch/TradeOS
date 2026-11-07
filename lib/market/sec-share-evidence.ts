import {createHash} from 'node:crypto';

// Explicitly reviewed issuer/filing policy, not a generic sum of XBRL dimensions.
export const META_SHARE_POLICY={
 symbol:'META',cik:'0001326801',accession:'0001628280-26-066773',filed:'2026-10-22',
 url:'https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm',
 sha256:'3ffe3ab3ece24f40f3a7662c5bd4167f4bd1750249572add801175d5e7acabb1',
 // Charter effectiveness is a stop date, NOT an assumed dividend payment date.
 stopAt:'2027-01-19T00:00:00Z',maxShareAgeDays:120,
 pricingMethod:'Class_A_price_proxy_for_A_and_B_equal_economic_rights_not_separate_class_market_quotes',
 rightsSource:'https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm',
 actionSource:'https://www.sec.gov/Archives/edgar/data/1326801/000162828026068935/meta-20261102.htm',
} as const;
export type ShareComponent={member:string;value:number;contextId:string;instant:string;rawFact:string;rawContext:string};
export type ShareEvidence={shares:number;end:string;filed:string;accession:string;acceptedAt:string;sourceUrl:string;rawSha256:string;receivedAt:string;components:ShareComponent[];pricingMethod:string;backtestEligible:false};
export type ShareResult={observation?:ShareEvidence;reason?:string;blockingAccessions?:string[]};
const attr=(s:string,key:string)=>new RegExp('(?:^|\\s)'+key+'="([^"]*)"').exec(s)?.[1];
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
/** Narrow reviewed iXBRL shape. Unsupported units, dimensions, precision or markup fail closed. */
export function parseMetaShareClasses(html:string):ShareComponent[]|null{
 const contexts=new Map<string,string>();
 for(const m of html.matchAll(/<xbrli:context\b([^>]*)>([\s\S]*?)<\/xbrli:context>/g)){
  const id=attr(m[1],'id');if(!id||contexts.has(id))return null;contexts.set(id,m[0]);
 }
 const units=[...html.matchAll(/<xbrli:unit\b([^>]*)>([\s\S]*?)<\/xbrli:unit>/g)].filter(m=>attr(m[1],'id')==='shares');
 if(units.length!==1||units[0][2].trim()!=='<xbrli:measure>xbrli:shares</xbrli:measure>')return null;
 const components:ShareComponent[]=[];
 for(const m of html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)){
  if(attr(m[1],'name')!=='dei:EntityCommonStockSharesOutstanding')continue;
  if(attr(m[1],'unitRef')!=='shares'||attr(m[1],'scale')!=='0'||attr(m[1],'decimals')!=='INF'||attr(m[1],'sign')||attr(m[1],'xsi:nil')||attr(m[1],'format')!=='ixt:num-dot-decimal')return null;
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(m[2]))return null;
  const value=Number(m[2].replaceAll(',','')),contextId=attr(m[1],'contextRef')??'',context=contexts.get(contextId);
  if(!Number.isSafeInteger(value)||value<=0||!context)return null;
  if(!context.includes('<xbrli:identifier scheme="http://www.sec.gov/CIK">0001326801</xbrli:identifier>'))return null;
  const dims=[...context.matchAll(/<xbrldi:explicitMember dimension="([^"]+)">([^<]+)<\/xbrldi:explicitMember>/g)];
  if(dims.length!==1||dims[0][1]!=='us-gaap:StatementClassOfStockAxis'||context.includes('typedMember')||context.includes('scenario')||context.includes('startDate'))return null;
  const member=dims[0][2],instant=/<xbrli:instant>([^<]+)<\/xbrli:instant>/.exec(context)?.[1]??'';
  if(!['us-gaap:CommonClassAMember','us-gaap:CommonClassBMember'].includes(member)||!validDate(instant))return null;
  components.push({member,value,contextId,instant,rawFact:m[0],rawContext:context});
 }
 if(components.length!==2||new Set(components.map(c=>c.member)).size!==2||new Set(components.map(c=>c.instant)).size!==1)return null;
 return components;
}
export function validateMetaShareEvidence(html:string,submissions:any,asOf:string,receivedAt:string):ShareResult{
 const policy=META_SHARE_POLICY,cutoff=Date.parse(asOf),received=Date.parse(receivedAt);
 if(!Number.isFinite(cutoff)||!Number.isFinite(received)||cutoff>received)return {reason:'invalid_share_request_time'};
 if(cutoff>=Date.parse(policy.stopAt))return {reason:'recapitalization_requires_new_class_and_price_review'};
 if(String(submissions?.cik).padStart(10,'0')!==policy.cik)return {reason:'issuer_mismatch'};
 const recent=submissions?.filings?.recent;
 if(!Array.isArray(recent?.accessionNumber)||!['form','filingDate','acceptanceDateTime','primaryDocument'].every(k=>Array.isArray(recent[k])&&recent[k].length===recent.accessionNumber.length))return {reason:'invalid_submissions'};
 if(new Set(recent.accessionNumber).size!==recent.accessionNumber.length)return {reason:'ambiguous_submissions_accessions'};
 const i=recent.accessionNumber.indexOf(policy.accession),acceptedAt=recent.acceptanceDateTime[i];
 if(i<0||recent.form[i]!=='10-Q'||recent.filingDate[i]!==policy.filed||recent.primaryDocument[i]!=='meta-20260930.htm'||!Number.isFinite(Date.parse(acceptedAt))||Date.parse(acceptedAt)>=cutoff||Date.parse(policy.filed+'T23:59:59Z')>=cutoff)return {reason:'filing_identity_or_availability_mismatch'};
 const hash=createHash('sha256').update(html).digest('hex');
 if(hash!==policy.sha256)return {reason:'unreviewed_filing_content'};
 const components=parseMetaShareClasses(html);
 if(!components)return {reason:'unsupported_share_class_combination'};
 const end=components[0].instant,age=(cutoff-Date.parse(end+'T00:00:00Z'))/86400000;
 if(age<0||age>policy.maxShareAgeDays||end>policy.filed)return {reason:'share_instant_outside_supported_window'};
 const shares=components.reduce((n,c)=>n+c.value,0);
 if(!Number.isSafeInteger(shares))return {reason:'invalid_share_total'};
 const observation:ShareEvidence={shares,end,filed:policy.filed,accession:policy.accession,acceptedAt,sourceUrl:policy.url,rawSha256:hash,receivedAt,components,pricingMethod:policy.pricingMethod,backtestEligible:false};
 // Ownership reports do not establish issuer issuance/settlement. All other later
 // filings require explicit review before this snapshot can price current equity.
 const actions=metaSubsequentFilingReview(recent,acceptedAt,asOf);
 if(actions.reason)return {observation,...actions};
 return {observation};
}
export async function secMetaShareEvidence(asOf:string):Promise<ShareResult>{
 try{
  const headers={'User-Agent':'TradeOS market research contact: studio2016@icloud.com'};
  const [filing,sub]=await Promise.all([
   fetch(META_SHARE_POLICY.url,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)}),
   fetch('https://data.sec.gov/submissions/CIK0001326801.json',{headers,cache:'no-store',signal:AbortSignal.timeout(12000)})
  ]);
  if(!filing.ok||!sub.ok)return {reason:'share_source_http_error'};
  const html=await filing.text(),submissions=await sub.json();
  return validateMetaShareEvidence(html,submissions,asOf,new Date().toISOString());
 }catch{return {reason:'share_source_collection_failed'};}
}
/** Conservative last-trade age bound includes a normal weekend; never backdates availability. */
export function valuationPriceReason(price:number,observedAt:string,asOf:string,shares?:{filed:string;end:string}){
 const t=Date.parse(observedAt),now=Date.parse(asOf);
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(t)||!Number.isFinite(now))return 'market_price_missing_or_invalid';
 if(t>now||now-t>96*3600000)return 'market_price_outdated_or_future';
 if(shares&&(!validDate(shares.filed)||!validDate(shares.end)||t<=Date.parse(shares.filed+'T23:59:59Z')||Date.parse(shares.end)>t||now-Date.parse(shares.end)>120*86400000))return 'price_share_filing_date_mismatch';
 return null;
}

export function metaSubsequentFilingReview(recent:any,acceptedAt:string,asOf:string):Pick<ShareResult,'reason'|'blockingAccessions'>{
 const blockingAccessions:string[]=[],cutoff=Date.parse(asOf),accepted=Date.parse(acceptedAt);
 if(!Number.isFinite(cutoff)||!Number.isFinite(accepted)||!Array.isArray(recent?.accessionNumber)||!['form','acceptanceDateTime'].every(k=>Array.isArray(recent[k])&&recent[k].length===recent.accessionNumber.length))return {reason:'invalid_submissions'};
 for(let j=0;j<recent.accessionNumber.length;j++){
  const t=Date.parse(recent.acceptanceDateTime[j]);
  if(!Number.isFinite(t))return {reason:'invalid_subsequent_filing_timestamp'};
  if(t>accepted&&t<=cutoff&&!['3','3/A','4','4/A','5','5/A','144','144/A'].includes(recent.form[j]))blockingAccessions.push(recent.accessionNumber[j]);
 }
 return blockingAccessions.length?{reason:'subsequent_filings_require_corporate_action_review',blockingAccessions}:{};
}
export function annualValuationInputUsable(value:number,p:{start?:string;end:string;filed:string;accession:string}|undefined,priceTime:string){
 if(!Number.isFinite(value)||!p?.start||!p.accession||![p.start,p.end,p.filed].every(validDate))return false;
 const days=(Date.parse(p.end)-Date.parse(p.start))/86400000;
 return days>=300&&days<=390&&p.end<=p.filed&&Date.parse(p.filed+'T23:59:59Z')<Date.parse(priceTime);
}
