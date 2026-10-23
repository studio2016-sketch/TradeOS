import {brokerReadStatus} from "./alpaca";
type Fill={id:string;symbol:string;side:string;qty:number;price:number;at:string};
const finite=(x:number)=>Number.isFinite(x);
function sessionDate(at:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(at));}
/** Long-only FIFO accounting. Missing cost-basis history, short sales and non-fill
 * adjustments are not treated as zero. Historical completeness is mandatory. */
export function reconcileDailyRealizedPnl(fills:Fill[],date:string,complete:boolean){
 if(!complete)return {verified:false as const,reason:"incomplete_trade_history"};
 const lots=new Map<string,Array<{qty:number;price:number}>>();
 let realized=0,closingFills=0;
 const seen=new Set<string>();
 for(const f of [...fills].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
  if(!f.id||seen.has(f.id)||!f.symbol||!["buy","sell"].includes(f.side)||
   !finite(f.qty)||f.qty<=0||!finite(f.price)||f.price<=0||!finite(Date.parse(f.at)))
   return {verified:false as const,reason:"invalid_or_duplicate_fill"};
  seen.add(f.id);
  const day=sessionDate(f.at);
  if(day>date)return {verified:false as const,reason:"future_fill_in_history"};
  const inventory=lots.get(f.symbol)??[];
  if(f.side==="buy")inventory.push({qty:f.qty,price:f.price});
  else{
   let remaining=f.qty;
   while(remaining>1e-9){
    const lot=inventory[0];
    if(!lot)return {verified:false as const,reason:"missing_opening_cost_basis_or_short_sale"};
    const used=Math.min(remaining,lot.qty);
    if(day===date){realized+=used*(f.price-lot.price);closingFills++;}
    remaining-=used;lot.qty-=used;
    if(lot.qty<1e-9)inventory.shift();
   }
  }
  lots.set(f.symbol,inventory);
 }
 return {verified:true as const,realizedPnl:realized,closingFills,method:"fifo_gross_before_fees" as const};
}
export async function readPaperRiskAccounting(date:string){
 const status=brokerReadStatus();
 if(!status.enabled||!status.credentials||status.environment!=="paper")
  return {verified:false as const,reason:"paper_broker_read_not_authorized"};
 const key=process.env.ALPACA_API_KEY!,secret=process.env.ALPACA_API_SECRET!;
 const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret,"Accept":"application/json"};
 const base="https://paper-api.alpaca.markets";
 const fills:Fill[]=[];let token="",complete=false;
 for(let page=0;page<100;page++){
  const url=new URL(base+"/v2/account/activities");
  url.searchParams.set("activity_types","FILL");url.searchParams.set("direction","asc");
  url.searchParams.set("page_size","100");
  if(token)url.searchParams.set("page_token",token);
  const res=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {verified:false as const,reason:"broker_activities_http_"+res.status};
  const rows=await res.json() as any[];
  if(!Array.isArray(rows))return {verified:false as const,reason:"invalid_broker_activity_response"};
  for(const x of rows)fills.push({id:String(x.id??""),symbol:String(x.symbol??""),
   side:String(x.side??"").toLowerCase(),qty:Number(x.qty),price:Number(x.price),
   at:String(x.transaction_time??"")});
  if(rows.length<100){complete=true;break;}
  const next=String(rows.at(-1)?.id??"");
  if(!next||next===token)break;token=next;
 }
 const pnl=reconcileDailyRealizedPnl(fills,date,complete);
 // Fees, corporate actions, transfers and cost-basis adjustments require separate
 // reconciliation. Gross FIFO results are diagnostic, not certified net realized P&L.
 return {...pnl,verified:false as const,reason:pnl.verified?
  "gross_fifo_requires_fee_corporate_action_and_cost_basis_reconciliation":pnl.reason,
  fillCount:fills.length,historyComplete:complete};
}
