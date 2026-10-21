export interface BrokerAccountState{
  environment:"live"|"paper";
  accountStatus:string;
  tradingBlocked:boolean;
  accountBlocked:boolean;
  tradeSuspendedByUser:boolean;
  equity:number|null;
  lastEquity:number|null;
  cash:number|null;
  buyingPower:number|null;
  daytradeCount:number|null;
  portfolioValue:number|null;
  positions:Array<{
    symbol:string;qty:number;side:string;marketValue:number;costBasis:number;unrealizedPl:number;unrealizedPlpc:number;currentPrice:number
  }>;
  openOrders:Array<{
    id:string;symbol:string;side:string;type:string;qty:number|null;limitPrice:number|null;stopPrice:number|null;status:string
  }>;
  generatedAt:string;
}

function enabled(){return process.env.TRADEOS_ALLOW_ACCOUNT_READ==="true"}
function envName(): "live"|"paper"|null{
  const e=process.env.ALPACA_TRADING_ENV;
  return e==="live"||e==="paper"?e:null;
}
function base(env:"live"|"paper"){return env==="paper"?"https://paper-api.alpaca.markets":"https://api.alpaca.markets"}
function n(v:any){const x=Number(v);return Number.isFinite(x)?x:null}

export function brokerReadStatus(){
  return {
    enabled:enabled(),
    environment:envName(),
    credentials:Boolean(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET),
    mode:"read_only" as const
  };
}

export async function alpacaBrokerState():Promise<BrokerAccountState|null>{
  if(!enabled())return null;
  const env=envName();
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!env||!key||!secret)return null;
  const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret,"Accept":"application/json"};
  const b=base(env);
  const [accountRes,positionsRes,ordersRes]=await Promise.all([
    fetch(b+"/v2/account",{headers,cache:"no-store"}),
    fetch(b+"/v2/positions",{headers,cache:"no-store"}),
    fetch(b+"/v2/orders?status=open&limit=500&direction=desc",{headers,cache:"no-store"})
  ]);
  if(!accountRes.ok)throw new Error(`Alpaca account HTTP ${accountRes.status}`);
  if(!positionsRes.ok)throw new Error(`Alpaca positions HTTP ${positionsRes.status}`);
  if(!ordersRes.ok)throw new Error(`Alpaca orders HTTP ${ordersRes.status}`);
  const a=await accountRes.json() as any;
  const positions=await positionsRes.json() as any[];
  const orders=await ordersRes.json() as any[];
  return{
    environment:env,
    accountStatus:String(a.status??"unknown"),
    tradingBlocked:Boolean(a.trading_blocked),
    accountBlocked:Boolean(a.account_blocked),
    tradeSuspendedByUser:Boolean(a.trade_suspended_by_user),
    equity:n(a.equity),lastEquity:n(a.last_equity),cash:n(a.cash),buyingPower:n(a.buying_power),
    daytradeCount:n(a.daytrade_count),portfolioValue:n(a.portfolio_value),
    positions:(positions??[]).map((p:any)=>({
      symbol:String(p.symbol),qty:Number(p.qty??0),side:String(p.side??""),marketValue:Number(p.market_value??0),
      costBasis:Number(p.cost_basis??0),unrealizedPl:Number(p.unrealized_pl??0),unrealizedPlpc:Number(p.unrealized_plpc??0),
      currentPrice:Number(p.current_price??0)
    })),
    openOrders:(orders??[]).map((o:any)=>({
      id:String(o.id),symbol:String(o.symbol??""),side:String(o.side??""),type:String(o.type??o.order_type??""),
      qty:n(o.qty),limitPrice:n(o.limit_price),stopPrice:n(o.stop_price),status:String(o.status??"")
    })),
    generatedAt:new Date().toISOString()
  };
}


export interface BrokerReconciliation{
  environment:"live"|"paper";
  accountStatus:string;
  positionsCount:number;
  openOrdersCount:number;
  closedOrdersCount:number;
  fillActivitiesCount:number;
  nonTradeActivitiesCount:number;
  coverage:"complete_empty_account"|"complete_activity_history"|"partial_activity_history";
  historyComplete:boolean;
  transactionLineageComplete:boolean;
  reconciled:false;
  account:{equity:number|null;cash:number|null;buyingPower:number|null;portfolioValue:number|null};
  positions:BrokerAccountState["positions"];
  openOrders:BrokerAccountState["openOrders"];
  closedOrders:Array<{id:string;symbol:string;side:string;qty:number|null;filledQty:number|null;status:string;filledAt:string|null}>;
  fills:Array<{id:string;symbol:string;side:string;qty:number|null;price:number|null;transactionTime:string|null;orderId:string|null}>;
  nonTradeActivities:Array<{id:string;activityType:string;date:string|null;netAmount:number|null}>;
  orphanFillOrderIds:string[];
  filledOrdersMissingActivity:string[];
  pages:{closedOrders:number;tradeActivities:number;nonTradeActivities:number};
  generatedAt:string;
  note:string;
}

async function fetchAllAccountActivities(b:string,headers:Record<string,string>,category:"trade_activity"|"non_trade_activity"){
  const rows:any[]=[];let pageToken:string|undefined;let pages=0;let complete=false;
  for(;pages<100;pages++){
    const url=new URL(b+"/v2/account/activities");
    url.searchParams.set("category",category);url.searchParams.set("direction","asc");url.searchParams.set("page_size","100");
    if(pageToken)url.searchParams.set("page_token",pageToken);
    const res=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw new Error(`Alpaca ${category} activities HTTP ${res.status}`);
    const page=await res.json() as any[];
    rows.push(...(page??[]));
    if(!Array.isArray(page)||page.length<100){complete=true;pages++;break;}
    const last=String(page.at(-1)?.id??"");
    if(!last||last===pageToken){pages++;break;}
    pageToken=last;
  }
  return {rows,complete,pages};
}

async function fetchAllClosedOrders(b:string,headers:Record<string,string>){
  const rows:any[]=[];let afterId:string|undefined;let pages=0;let complete=false;
  for(;pages<50;pages++){
    const url=new URL(b+"/v2/orders");
    url.searchParams.set("status","closed");url.searchParams.set("limit","500");url.searchParams.set("direction","asc");url.searchParams.set("nested","true");
    if(afterId)url.searchParams.set("after_order_id",afterId);
    const res=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw new Error(`Alpaca closed orders HTTP ${res.status}`);
    const page=await res.json() as any[];
    rows.push(...(page??[]));
    if(!Array.isArray(page)||page.length<500){complete=true;pages++;break;}
    const last=String(page.at(-1)?.id??"");
    if(!last||last===afterId){pages++;break;}
    afterId=last;
  }
  return {rows,complete,pages};
}

export async function alpacaBrokerReconciliation():Promise<BrokerReconciliation|null>{
  const state=await alpacaBrokerState();
  if(!state)return null;
  const env=state.environment;
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return null;
  const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret,"Accept":"application/json"};
  const b=base(env);
  const [orders,trade,nonTrade]=await Promise.all([
    fetchAllClosedOrders(b,headers),
    fetchAllAccountActivities(b,headers,"trade_activity"),
    fetchAllAccountActivities(b,headers,"non_trade_activity")
  ]);
  const closedOrders=orders.rows.map((o:any)=>({
    id:String(o.id),symbol:String(o.symbol??""),side:String(o.side??""),qty:n(o.qty),filledQty:n(o.filled_qty),
    status:String(o.status??""),filledAt:o.filled_at?String(o.filled_at):null
  }));
  const fillActivities=trade.rows.filter((a:any)=>String(a.activity_type??a.type??"").toUpperCase()==="FILL").map((a:any)=>({
    id:String(a.id??""),symbol:String(a.symbol??""),side:String(a.side??""),qty:n(a.qty),price:n(a.price),
    transactionTime:a.transaction_time?String(a.transaction_time):null,orderId:a.order_id?String(a.order_id):null
  }));
  const nonTradeActivities=nonTrade.rows.map((a:any)=>({
    id:String(a.id??""),activityType:String(a.activity_type??a.type??""),date:a.date?String(a.date):a.transaction_time?String(a.transaction_time):null,
    netAmount:n(a.net_amount??a.amount??a.price)
  }));
  const orderIds=new Set([...closedOrders.map(o=>o.id),...state.openOrders.map(o=>o.id)]);
  const fillOrderIds=new Set(fillActivities.map(x=>x.orderId).filter((x):x is string=>Boolean(x)));
  const orphanFillOrderIds=[...fillOrderIds].filter(id=>!orderIds.has(id));
  const filledOrdersMissingActivity=closedOrders.filter(o=>(o.filledQty??0)>0&&!fillOrderIds.has(o.id)).map(o=>o.id);
  const historyComplete=orders.complete&&trade.complete&&nonTrade.complete;
  const transactionLineageComplete=historyComplete&&orphanFillOrderIds.length===0&&filledOrdersMissingActivity.length===0;
  const empty=state.positions.length===0&&state.openOrders.length===0&&closedOrders.length===0&&fillActivities.length===0&&nonTradeActivities.length===0;
  const coverage=empty&&historyComplete?"complete_empty_account":historyComplete?"complete_activity_history":"partial_activity_history";
  return{
    environment:env,accountStatus:state.accountStatus,positionsCount:state.positions.length,openOrdersCount:state.openOrders.length,
    closedOrdersCount:closedOrders.length,fillActivitiesCount:fillActivities.length,nonTradeActivitiesCount:nonTradeActivities.length,
    coverage,historyComplete,transactionLineageComplete,reconciled:false,
    account:{equity:state.equity,cash:state.cash,buyingPower:state.buyingPower,portfolioValue:state.portfolioValue},
    positions:state.positions,openOrders:state.openOrders,closedOrders,fills:fillActivities,nonTradeActivities,
    orphanFillOrderIds,filledOrdersMissingActivity,pages:{closedOrders:orders.pages,tradeActivities:trade.pages,nonTradeActivities:nonTrade.pages},
    generatedAt:new Date().toISOString(),
    note:"Read-only activity-history collection is complete only when every pagination stream terminates naturally. Full certification still requires independent cash/position/order/fill identity checks and does not follow from pagination alone."
  };
}

