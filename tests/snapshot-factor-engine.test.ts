import test from "node:test";
import assert from "node:assert/strict";
import {calculateSnapshotFactors} from "../lib/research/snapshot-factor-engine.ts";

test("snapshot factors match independent arithmetic vectors",()=>{
 const out=calculateSnapshotFactors({timestamp:"2026-10-23T14:30:30Z",quoteTimestamp:"2026-10-23T14:30:29Z",price:102,volume:2500,vwap:100,bid:101,ask:103,bidSize:30,askSize:10});
 assert.equal(out.daily_volume,2500);
 assert.equal(out.distance_vwap,.02);
 assert.equal(out.bid_ask_spread,2);
 assert.ok(out.spread_bps!==null&&Math.abs(out.spread_bps-196.07843137254903)<1e-10);
 assert.equal(out.quoted_depth,40);
 assert.equal(out.order_imbalance,.5);
});
test("snapshot quote factors fail closed for future or stale quotes",()=>{
 const future=calculateSnapshotFactors({timestamp:"2026-10-23T14:30:30Z",quoteTimestamp:"2026-10-23T14:30:31Z",price:100,bid:99,ask:101,bidSize:2,askSize:2});
 const stale=calculateSnapshotFactors({timestamp:"2026-10-23T14:32:00Z",quoteTimestamp:"2026-10-23T14:30:00Z",price:100,bid:99,ask:101,bidSize:2,askSize:2});
 for(const out of [future,stale])for(const key of ["bid_ask_spread","spread_bps","quoted_depth","order_imbalance"] as const)assert.equal(out[key],null);
});
