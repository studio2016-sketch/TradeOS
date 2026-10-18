import test from "node:test";import assert from "node:assert/strict";import {rankAssetMatches} from "../lib/market/assetSearch";
const make=(symbol:string,name:string)=>({symbol,name,exchange:"NASDAQ",fractionable:true});
test("An exact ticker ranks ahead of hundreds of funds mentioning the ticker in their names",()=>{
 const funds=Array.from({length:160},(_,i)=>make("ETF"+i,"Fund referencing AAPL "+i));
 const ranked=rankAssetMatches([...funds,make("AAPL","Apple Inc.")],"AAPL");
 assert.equal(ranked[0].symbol,"AAPL");
 assert.equal(ranked.slice(0,100).some(x=>x.symbol==="AAPL"),true);
});
test("Search prioritizes symbol prefixes over company name matches",()=>{
 const result=rankAssetMatches([make("AAPY","Fund linked to AAPL"),make("AAPL","Apple"),make("AAPX","AAPL daily ETF")],"aap");
 assert.deepEqual(result.map(x=>x.symbol),["AAPL","AAPX","AAPY"]);
});
test("Empty search retains all eligible assets",()=>assert.equal(rankAssetMatches([make("AAPL","Apple"),make("MSFT","Microsoft")],"").length,2));
