import type {MarketSnapshot} from './types';

/** Prospective accounting only: timestamps belong to the selected snapshot, not every provider response. */
export function marketPersistenceDiagnostics(requested:string[],snapshots:MarketSnapshot[],writes:{symbol:string;source:string;saved:boolean}[]){
 return {schema:'tradeos.market-persistence.v1',requestedSymbols:[...new Set(requested)],
  unselectedSymbols:[...new Set(requested)].filter(s=>!snapshots.some(x=>x.symbol===s)),
  selected:snapshots.map(s=>{
   const write=writes.find(w=>w.symbol===s.symbol&&w.source===s.source);
   return {symbol:s.symbol,sourceId:s.source,priceAt:s.timestamp,quoteAt:s.quoteTimestamp??null,
    persistence:write?(write.saved?'INSERTED':'CONFLICT_NO_INSERT'):'NOT_COMPLETED'};
  })};
}
