import assert from "node:assert/strict";
import test from "node:test";
import {createPaperDiagnosticRequest} from "../lib/paper/diagnosticRequest";

function fixture(){
 const states:any[]=[];
 const pending:{resolve:(response:Response)=>void;reject:(reason:Error)=>void;signal:AbortSignal}[]=[];
 const request=((url:string,init:RequestInit)=>new Promise<Response>((resolve,reject)=>pending.push({resolve,reject,signal:init.signal as AbortSignal}))) as typeof fetch;
 return{states,pending,loader:createPaperDiagnosticRequest(state=>states.push(state),request)};
}
test("new symbol request ignores an old response even when transport ignores abort",async()=>{
 const {loader,states,pending}=fixture();
 const old=loader.load("SPY");loader.cancel();const latest=loader.load("QQQ");
 pending[1].resolve(Response.json({symbol:"QQQ",decision:{status:"QQQ_ONLY"}}));await latest;
 pending[0].resolve(Response.json({symbol:"SPY",decision:{status:"SPY_OLD"}}));await old;
 assert.equal(pending[0].signal.aborted,true);assert.equal(states.at(-1).decision.status,"QQQ_ONLY");
 assert.equal(states.some(s=>s.decision?.status==="SPY_OLD"),false);
});
test("overlapping loads automatically cancel and replace the previous request",async()=>{
 const {loader,states,pending}=fixture();const first=loader.load("SPY");const second=loader.load("QQQ");
 assert.equal(pending[0].signal.aborted,true);
 pending[0].reject(new Error("late failure"));await first;assert.equal(states.at(-1).symbol,"QQQ");assert.equal(states.at(-1).status,"loading");
 pending[1].resolve(Response.json({symbol:"QQQ",decision:{status:"LATEST"}}));await second;
 assert.equal(states.at(-1).decision.status,"LATEST");
});
test("switch away and back or repeated requests cannot revive an older same-symbol result",async()=>{
 const {loader,states,pending}=fixture();const first=loader.load("SPY");loader.cancel();const second=loader.load("SPY");
 pending[0].resolve(Response.json({symbol:"SPY",decision:{status:"OLD"}}));await first;
 assert.equal(states.at(-1).status,"loading");
 pending[1].resolve(Response.json({symbol:"SPY",decision:{status:"NEW"}}));await second;
 assert.equal(states.at(-1).decision.status,"NEW");
});
test("cancel during response body parsing suppresses both completion and obsolete errors",async()=>{
 const {loader,states,pending}=fixture();let body!:(value:unknown)=>void;
 const task=loader.load("SPY");pending[0].resolve({ok:true,json:()=>new Promise(resolve=>body=resolve)} as Response);
 await Promise.resolve();loader.cancel();const count=states.length;body({symbol:"SPY",decision:{status:"OLD"}});await task;
 assert.equal(states.length,count);
 const next=loader.load("QQQ");loader.cancel();const before=states.length;pending[1].reject(new Error("obsolete failure"));await next;
 assert.equal(states.length,before);
});
test("wrong-symbol and missing-symbol successful responses fail closed",async()=>{
 for(const result of [{symbol:"QQQ"},{},null]){
  const {loader,states,pending}=fixture();const task=loader.load("SPY");pending[0].resolve(Response.json(result));await task;
  assert.equal(states.at(-1).status,"unavailable");assert.equal(states.at(-1).symbol,"SPY");
 }
});
test("HTTP, transport and JSON failures allow a later successful retry",async()=>{
 const {loader,states,pending}=fixture();
 const http=loader.load("SPY");pending[0].resolve(new Response("",{status:503}));await http;assert.match(states.at(-1).message,/503/);
 const network=loader.load("SPY");pending[1].reject(new Error("offline"));await network;assert.equal(states.at(-1).status,"unavailable");
 const json=loader.load("SPY");pending[2].resolve(new Response("invalid"));await json;assert.equal(states.at(-1).status,"unavailable");
 const retry=loader.load("SPY");pending[3].resolve(Response.json({symbol:"SPY",decision:{status:"RESEARCH_ONLY"},warning:"No trading authorization"}));await retry;
 assert.equal(states.at(-1).decision.status,"RESEARCH_ONLY");assert.equal(states.at(-1).warning,"No trading authorization");
});
