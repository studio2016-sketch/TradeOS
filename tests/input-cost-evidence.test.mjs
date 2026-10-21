import test from "node:test";
import assert from "node:assert/strict";
import {standardizedLatestChange} from "../lib/research/input-cost-evidence.ts";

test("input-cost shock standardizes latest monthly change against trailing history",()=>{
 const values=[100,101,102,101.5,102.5,103,104,103.5,104.2,105,105.4,106,106.2,110];
 const out=standardizedLatestChange(values);
 assert.ok(out!==null);
 assert.ok(Number.isFinite(out.z));
 assert.ok(out.historyCount>=12);
});
test("input-cost shock fails closed with insufficient or flat history",()=>{
 assert.equal(standardizedLatestChange([1,2,3]),null);
 assert.equal(standardizedLatestChange(Array(20).fill(100)),null);
});
