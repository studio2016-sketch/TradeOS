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
