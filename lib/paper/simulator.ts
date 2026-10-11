export type PaperOrder = {side:"buy"; symbol:string;quantity:number;limitPrice:number;stopPrice:number;targetPrice:number;maxRisk:number};
export type PaperQuote = {symbol:string;bid:number;ask:number;observedAt:string;source:string};
export type PaperResult = {status:"rejected"|"unfilled"|"filled";reason:string;filledShares:number;fillPrice:number|null;fee:number;plannedRisk:number;estimatedSpreadCost:number;sourceTime:string|null};
/** Research-only deterministic simulator. No broker or network calls. */
export function simulatePaperBuy(order:PaperOrder,quote:PaperQuote|null,nowMs:number=Date.now()):PaperResult {
 const base=(status:PaperResult["status"],reason:string):PaperResult=>({status,reason,filledShares:0,fillPrice:null,fee:0,plannedRisk:0,estimatedSpreadCost:0,sourceTime:quote?.observedAt??null});
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(order.symbol)||order.side!=="buy"||![order.quantity,order.limitPrice,order.stopPrice,order.targetPrice,order.maxRisk].every(x=>Number.isFinite(x)&&x>0)||!Number.isInteger(order.quantity)||order.quantity>100000)return base("rejected","Invalid paper order parameters.");
 if(!(order.stopPrice<order.limitPrice&&order.targetPrice>order.limitPrice))return base("rejected","Stop must be below entry; target must be above.");
 if((order.limitPrice-order.stopPrice)*order.quantity>order.maxRisk+1e-8)return base("rejected","Planned loss exceeds maximum risk.");
 if(!quote||quote.symbol!==order.symbol)return base("rejected","No matching authenticated market observation.");
 const ts=Date.parse(quote.observedAt);
 if(!Number.isFinite(ts)||ts>nowMs+60000||nowMs-ts>60000||nowMs<ts)return base("rejected","Market observation stale, invalid or from the future.");
 if(!quote.source||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask)||quote.bid<=0||quote.ask<=0||quote.bid>quote.ask)return base("rejected","Invalid market quote.");
 if(quote.ask>order.limitPrice)return base("unfilled","Ask exceeds the limit price; no hypothetical execution.");
 const mid=(quote.bid+quote.ask)/2;
 const cost=(quote.ask-mid)*order.quantity;
 return {status:"filled",reason:"Illustrative immediate full fill at the displayed ask, NOT an actual execution.",filledShares:order.quantity,fillPrice:quote.ask,fee:0,plannedRisk:(quote.ask-order.stopPrice)*order.quantity,estimatedSpreadCost:cost,sourceTime:quote.observedAt};
}
