import {brokerReadStatus} from "./alpaca";
export interface ActivityCoverage{environment:"paper"|"live";status:"RETRIEVED_PARTIAL_HISTORY"|"NO_ACTIVITIES";pages:number;records:number;earliestActivityAt:string|null;latestActivityAt:string|null;types:Record<string,number>;missingTimestamps:number;cashEffectSum:number|null;fills:number;historyComplete:false;warnings:string[]}
export async function readAlpacaActivityCoverage(maxPages=20):Promise<ActivityCoverage|null>{
 const state=brokerReadStatus();if(!state.enabled||!state.credentials||!state.environment)return null;
 const key=process.env.ALPACA_API_KEY!,secret=process.env.ALPACA_API_SECRET!;
 const base=state.environment==="paper"?"https://paper-api.alpaca.markets":"https://api.alpaca.markets";
 const seen=new Set<string>(),rows:any[]=[];let token="",pages=0,more=true;
 while(more&&pages<maxPages){
  const u=new URL(base+"/v2/account/activities");
  u.searchParams.set("direction","desc");u.searchParams.set("page_size","100");
  if(token)u.searchParams.set("page_token",token);
  const res=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(12000),headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret}});
  if(!res.ok)throw new Error("Alpaca activities HTTP "+res.status);
  const page=await res.json() as any[];
  if(!Array.isArray(page))throw new Error("Unexpected Alpaca activities response");
  pages++;
  for(const x of page){const id=String(x.id??"");if(id&&!seen.has(id)){seen.add(id);rows.push(x)}}
  const last=page.at(-1);const next=last?.id?String(last.id):"";
  more=page.length>=100&&next!==token;token=next;
 }
 const dates=rows.map(x=>String(x.transaction_time??x.date??"")).filter(x=>Number.isFinite(Date.parse(x))).sort();
 const sums=rows.map(x=>Number(x.net_amount)).filter(Number.isFinite);
 const types:Record<string,number>={};
 for(const x of rows){const t=String(x.activity_type??"UNKNOWN");types[t]=(types[t]||0)+1}
 return{environment:state.environment,status:rows.length?"RETRIEVED_PARTIAL_HISTORY":"NO_ACTIVITIES",
  pages,records:rows.length,earliestActivityAt:dates[0]??null,latestActivityAt:dates.at(-1)??null,
  types,missingTimestamps:rows.length-dates.length,cashEffectSum:sums.length===rows.length?sums.reduce((a,b)=>a+b,0):null,
  fills:types.FILL??0,historyComplete:false,
  warnings:["Alpaca activity enumeration is read-only and has not independently established inception-to-date completeness.",
   "Equity returns require reconciliation of opening/closing balances, interest, fees, dividends, deposits, transfers, corporate actions and price marks.",
   "No raw trade identifiers or confidential portfolio positions are exposed."]};
}
