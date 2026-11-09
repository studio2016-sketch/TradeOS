import type {NewsSignal} from './types';
import {evidenceTimestamp,evidenceTimestampIso} from '../research/evidence-time';

export const PROVIDER_NEWS_POLICY='tradeos.provider-news-intake.v1';
export function decodeProviderNews(provider:'alpaca'|'massive',input:unknown,receivedAt:string){
 const receipt=evidenceTimestamp(receivedAt);
 if(receipt===null)throw Error('Invalid news receipt clock');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid news response envelope');
 const response=input as Record<string,unknown>;
 if(response.error!=null&&response.error!==false&&response.error!==''||typeof response.status==='string'&&response.status.toUpperCase()==='ERROR')throw Error('Error-bearing news response');
 const rows=response[provider==='alpaca'?'news':'results'];
 if(!Array.isArray(rows))throw Error('Invalid news article array');
 const items:NewsSignal[]=[],rejected:{index:number;reason:string}[]=[];
 const reject=(index:number,reason:string)=>rejected.push({index,reason});
 const identity=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():typeof v==='number'&&Number.isSafeInteger(v)?String(v):null;
 for(const [index,row] of rows.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row)){reject(index,'invalid_article_shape');continue;}
  const n=row as Record<string,any>;
  if(n.id!=null&&identity(n.id)===null){reject(index,'invalid_article_identity');continue;}
  const id=identity(n.id)??(provider==='massive'?identity(n.article_url):null);
  if(!id){reject(index,'missing_article_identity');continue;}
  const headline=provider==='alpaca'?n.headline:n.title,symbols=provider==='alpaca'?n.symbols:n.tickers;
  const summary=provider==='alpaca'?n.summary:n.description;
  if(typeof headline!=='string'||!headline.trim()||!Array.isArray(symbols)||symbols.some(s=>typeof s!=='string'||!/^[A-Z0-9.-]{1,10}$/i.test(s))||summary!=null&&typeof summary!=='string'){
   reject(index,'invalid_article_fields');continue;
  }
  const clocks=provider==='alpaca'?[n.created_at,n.updated_at].filter(v=>v!=null):[n.published_utc];
  if(!clocks.length||clocks.every(v=>v==null)){reject(index,'missing_source_timestamp');continue;}
  const times=clocks.map(evidenceTimestamp);
  if(times.some(t=>t===null)){reject(index,'invalid_source_timestamp');continue;}
  if(times.some(t=>t!>receipt)){reject(index,'source_timestamp_after_receipt');continue;}
  if(provider==='alpaca'&&n.created_at!=null&&n.updated_at!=null&&evidenceTimestamp(n.updated_at)!<evidenceTimestamp(n.created_at)!){reject(index,'source_timestamp_reversal');continue;}
  // Preserve the existing Alpaca latest-version convention; never invent a missing clock.
  const selected=provider==='alpaca'?n.updated_at??n.created_at:n.published_utc;
  const timestamp=evidenceTimestampIso(selected)!;
  if(Number(timestamp.match(/[+-](\d{2}):\d{2}$/)?.[1]??0)>=16){reject(index,'unsupported_storage_timezone_offset');continue;}
  if(evidenceTimestamp(timestamp)! % BigInt(1000) !== BigInt(0)){reject(index,'unsupported_storage_precision');continue;}
  const publisher=provider==='massive'?n.publisher?.name:null;
  if(publisher!=null&&typeof publisher!=='string'){reject(index,'invalid_publisher');continue;}
  items.push({id:`${provider}:${id}`,timestamp,headline,symbols:[...new Set((symbols as string[]).map(s=>s.toUpperCase()))],source:provider==='alpaca'?'Alpaca News':`Massive / ${publisher??'News'}`,sourceQuality:provider==='alpaca' ? .86 : .78,novelty:1,marketImpact:.5,priceConfirmed:false,summary:summary??''});
 }
 return {items,received:rows.length,rejected,policyVersion:PROVIDER_NEWS_POLICY};
}
