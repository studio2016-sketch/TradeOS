import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {snapshotObservationState} from "../lib/market/freshness.ts";

const now=Date.parse("2026-11-04T19:30:00Z");
const recent="2026-11-04T19:29:45Z";
test("missing snapshots after provider failures are unverified, never recent",()=>{
 assert.equal(snapshotObservationState(undefined,now),"unverified");
 assert.equal(snapshotObservationState(null,now),"unverified");
});
test("invalid prices or timestamps cannot certify an observation",()=>{
 for(const price of [undefined,null,0,-1,NaN,Infinity,"100"])
  assert.equal(snapshotObservationState({price,timestamp:recent},now),"unverified");
 for(const timestamp of [undefined,"","garbage","2026-11-04T19:35:00Z"])
  assert.equal(snapshotObservationState({price:100,timestamp},now),"unverified");
});
test("classifications track the displayed price observation and age",()=>{
 assert.equal(snapshotObservationState({price:100,timestamp:recent},now),"recent_observation");
 assert.equal(snapshotObservationState({price:100,timestamp:"2026-11-04T19:29:00Z"},now),"delayed_observation");
 assert.equal(snapshotObservationState({price:100,timestamp:"2026-11-04T19:10:00Z"},now),"stale");
 assert.equal(snapshotObservationState({price:100,timestamp:recent},now+60_000),"delayed_observation");
});
test("partial market response counts only displayed valid observations",()=>{
 const symbols=["SPY","QQQ","IWM","NVDA","AMD","PLTR","AAPL"];
 const snapshots=[{symbol:"SPY",price:100,timestamp:recent}];
 const states=symbols.map(symbol=>snapshotObservationState(snapshots.find(s=>s.symbol===symbol),now));
 assert.equal(states.filter(s=>s==="recent_observation").length,1);
 assert.equal(states.filter(s=>s==="unverified").length,6);
});
test("board classifications use displayed snapshots without an independent verification fetch",()=>{
 const page=readFileSync(new URL("../app/live-board/page.tsx",import.meta.url),"utf8");
 assert.ok(!page.includes("/api/data-verification"));
 assert.ok(!page.includes("verification?.checks"));
 assert.ok(page.includes("snapshotObservationState(snapshots.find(s=>s.symbol===symbol),clock)"));
 assert.ok(page.includes("const report=checks.find(c=>c.symbol===selected)"));
 assert.ok(page.includes("v=checks.find(c=>c.symbol===sym)"));
 assert.ok(page.includes("if(id!==refreshId.current)return"));
});
