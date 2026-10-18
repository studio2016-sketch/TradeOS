export interface RankedAsset{symbol:string;name:string;exchange:string;fractionable:boolean}
export function rankAssetMatches<T extends RankedAsset>(assets:T[],rawQuery:string):T[]{
 const q=rawQuery.trim().toUpperCase();
 function rank(a:T){
  if(!q)return 5;
  const symbol=a.symbol.toUpperCase(),name=a.name.toUpperCase();
  if(symbol===q)return 0;
  if(symbol.startsWith(q))return 1;
  if(symbol.includes(q))return 2;
  if(name.startsWith(q))return 3;
  if(name.includes(q))return 4;
  return 9;
 }
 return assets.filter(a=>rank(a)<9).sort((a,b)=>rank(a)-rank(b)||a.symbol.localeCompare(b.symbol));
}
