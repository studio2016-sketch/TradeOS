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
  coverage:"complete_empty_account"|"complete_recent_activity"|"partial_activity_history";
  reconciled:boolean;
  account:{equity:number|null;cash:number|null;buyingPower:number|null;portfolioValue:number|null};
  positions:BrokerAccountState["positions"];
  openOrders:BrokerAccountState["openOrders"];
  closedOrders:Array<{id:string;symbol:string;side:string;qty:number|null;filledQty:number|null;status:string;filledAt:string|null}>;
  fills:Array<{id:string;symbol:string;side:string;qty:number|null;price:number|null;transactionTime:string|null;orderId:string|null}>;
  generatedAt:string;
  note:string;
}

export async function alpacaBrokerReconciliation():Promise<BrokerReconciliation|null>{
  const state=await alpacaBrokerState();
  if(!state)return null;
  const env=state.environment;
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return null;
  const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret,"Accept":"application/json"};
  const b=base(env);
  const [closedRes,fillsRes]=await Promise.all([
    fetch(b+"/v2/orders?status=closed&limit=500&direction=desc",{headers,cache:"no-store"}),
    fetch(b+"/v2/account/activities/FILL?direction=desc&page_size=100",{headers,cache:"no-store"})
  ]);
  if(!closedRes.ok)throw new Error(`Alpaca closed orders HTTP ${closedRes.status}`);
  if(!fillsRes.ok)throw new Error(`Alpaca fill activities HTTP ${fillsRes.status}`);
  const closed=await closedRes.json() as any[];
  const fills=await fillsRes.json() as any[];
  const closedOrders=(closed??[]).map((o:any)=>({
    id:String(o.id),symbol:String(o.symbol??""),side:String(o.side??""),qty:n(o.qty),filledQty:n(o.filled_qty),
    status:String(o.status??""),filledAt:o.filled_at?String(o.filled_at):null
  }));
  const fillActivities=(fills??[]).map((a:any)=>({
    id:String(a.id??""),symbol:String(a.symbol??""),side:String(a.side??""),qty:n(a.qty),price:n(a.price),
    transactionTime:a.transaction_time?String(a.transaction_time):null,orderId:a.order_id?String(a.order_id):null
  }));
  const empty=state.positions.length===0&&state.openOrders.length===0&&closedOrders.length===0&&fillActivities.length===0;
  const truncated=fillActivities.length>=100;
  const coverage=empty?"complete_empty_account":truncated?"partial_activity_history":"complete_recent_activity";
  const reconciled=empty||(!truncated&&state.accountStatus==="ACTIVE");
  return{
    environment:env,accountStatus:state.accountStatus,positionsCount:state.positions.length,openOrdersCount:state.openOrders.length,
    closedOrdersCount:closedOrders.length,fillActivitiesCount:fillActivities.length,coverage,reconciled,
    account:{equity:state.equity,cash:state.cash,buyingPower:state.buyingPower,portfolioValue:state.portfolioValue},
    positions:state.positions,openOrders:state.openOrders,closedOrders,fills:fillActivities,generatedAt:new Date().toISOString(),
    note:truncated?"Fill history reached the page limit; deeper pagination is required before claiming complete transaction-history reconciliation.":"Read-only reconciliation from Alpaca account, positions, open orders, closed orders and fill activities."
  };
}
