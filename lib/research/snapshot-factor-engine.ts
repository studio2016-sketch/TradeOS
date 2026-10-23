export const SNAPSHOT_FACTOR_KEYS=["daily_volume","distance_vwap","bid_ask_spread","spread_bps","quoted_depth","order_imbalance"] as const;
export type SnapshotFactorKey=typeof SNAPSHOT_FACTOR_KEYS[number];
export type SnapshotFactorInput={
 timestamp:string;price:number;volume?:number;vwap?:number;
 quoteTimestamp?:string;bid?:number;ask?:number;bidSize?:number;askSize?:number;
};

/** Pure point-in-time snapshot calculations. Missing or mismatched inputs stay null. */
export function calculateSnapshotFactors(snapshot:SnapshotFactorInput):Record<SnapshotFactorKey,number|null>{
 const out:Record<SnapshotFactorKey,number|null>={daily_volume:null,distance_vwap:null,bid_ask_spread:null,spread_bps:null,quoted_depth:null,order_imbalance:null};
 const marketTime=Date.parse(snapshot.timestamp),quoteTime=Date.parse(snapshot.quoteTimestamp??"");
 const volume=Number(snapshot.volume),price=Number(snapshot.price),vwap=Number(snapshot.vwap);
 if(Number.isFinite(volume)&&volume>=0)out.daily_volume=volume;
 if(Number.isFinite(price)&&price>0&&Number.isFinite(vwap)&&vwap>0)out.distance_vwap=(price-vwap)/vwap;
 const quoteAligned=Number.isFinite(marketTime)&&Number.isFinite(quoteTime)&&marketTime>=quoteTime&&marketTime-quoteTime<=60_000;
 const bid=Number(snapshot.bid),ask=Number(snapshot.ask),bidSize=Number(snapshot.bidSize),askSize=Number(snapshot.askSize);
 if(quoteAligned&&Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid){
  out.bid_ask_spread=ask-bid;
  const mid=(ask+bid)/2;
  if(mid>0)out.spread_bps=(ask-bid)/mid*10_000;
 }
 if(quoteAligned&&Number.isFinite(bidSize)&&Number.isFinite(askSize)&&bidSize>=0&&askSize>=0){
  const depth=bidSize+askSize;
  out.quoted_depth=depth;
  if(depth>0)out.order_imbalance=(bidSize-askSize)/depth;
 }
 return out;
}
