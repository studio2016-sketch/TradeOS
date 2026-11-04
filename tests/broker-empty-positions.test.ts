import test from "node:test";
import assert from "node:assert/strict";
import {alpacaBrokerState} from "../lib/broker/alpaca.ts";

test("broker accepts explicit empty positions but rejects missing or malformed payloads",async()=>{
 const names=["TRADEOS_ALLOW_ACCOUNT_READ","ALPACA_TRADING_ENV","ALPACA_API_KEY","ALPACA_API_SECRET"] as const;
 const previous=names.map(name=>process.env[name]),originalFetch=globalThis.fetch;
 Object.assign(process.env,{TRADEOS_ALLOW_ACCOUNT_READ:"true",ALPACA_TRADING_ENV:"paper",ALPACA_API_KEY:"fixture",ALPACA_API_SECRET:"fixture"});
 let positions:unknown=[];
 globalThis.fetch=async(input)=>{
  const url=String(input);
  const payload=url.includes("/v2/positions")?positions:url.includes("/v2/orders")?[]:{equity:"10000",status:"ACTIVE"};
  return new Response(JSON.stringify(payload),{status:200});
 };
 try{
  assert.deepEqual((await alpacaBrokerState())?.positions,[]);
  for(const invalid of [null,{},"",false]){
   positions=invalid;
   await assert.rejects(alpacaBrokerState(),/positions response must be an array/);
  }
 }finally{
  globalThis.fetch=originalFetch;
  names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});
 }
});
