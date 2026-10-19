import test from "node:test";
import assert from "node:assert/strict";
import {reconcileDualSource} from "../lib/market/dual-source.ts";

const NOW=Date.parse("2026-10-19T14:30:00.000Z");
const base=(source,price=100,changes={})=>({
 symbol:"NVDA",timestamp:new Date(NOW-1000).toISOString(),price,priceKind:"last_trade",
 volume:1000,source,coverage:"All US exchanges",entitlement:"full-market",...changes
});

test("comparable independent fresh feeds agree",()=>{
 const x=reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:sip",100.05)],NOW);
 assert.equal(x.status,"verified");
 assert.equal(x.certifiedDataEligible,true);
});
test("same provider family does not count twice",()=>{
 const x=reconcileDualSource("NVDA",[base("Alpaca:sip"),base("Alpaca:iex")],NOW);
 assert.equal(x.status,"unverified");
});
test("missing secondary fails closed",()=>{
 assert.equal(reconcileDualSource("NVDA",[base("Massive")],NOW).status,"unverified");
});
test("IEX coverage cannot certify consolidated price",()=>{
 assert.equal(reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:iex",100,{coverage:"IEX only",entitlement:"partial-real-time"})],NOW).status,"unverified");
});
test("delayed coverage cannot certify live agreement",()=>{
 assert.equal(reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:delayed_sip",100,{coverage:"All US exchanges / delayed"})],NOW).status,"unverified");
});
test("mismatched price kinds fail closed",()=>{
 assert.equal(reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:sip",100,{priceKind:"day_close"})],NOW).status,"unverified");
});
test("large disagreement is disputed",()=>{
 assert.equal(reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:sip",101)],NOW).status,"disputed");
});
test("stale primary fails closed",()=>{
 const old=new Date(NOW-70_000).toISOString();
 assert.equal(reconcileDualSource("NVDA",[base("Massive",100,{timestamp:old}),base("Alpaca:sip",100,{timestamp:old})],NOW).status,"stale");
});
test("future timestamps fail closed",()=>{
 const future=new Date(NOW+60_000).toISOString();
 assert.equal(reconcileDualSource("NVDA",[base("Massive",100,{timestamp:future}),base("Alpaca:sip",100,{timestamp:future})],NOW).status,"stale");
});
test("temporal skew fails closed",()=>{
 const earlier=new Date(NOW-40_000).toISOString();
 assert.equal(reconcileDualSource("NVDA",[base("Massive"),base("Alpaca:sip",100,{timestamp:earlier})],NOW).status,"unverified");
});
