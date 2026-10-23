import test from "node:test";
import assert from "node:assert/strict";
import {computeIvRank} from "../lib/research/iv-rank.ts";

test("IV rank uses current value between 252 distinct historical-session extrema",()=>{
 const history=Array.from({length:252},(_,i)=>0.20+i*0.01);
 const rank=computeIvRank(0.295,history);
 assert.ok(rank!==null&&rank>0&&rank<1);
});
test("IV rank fails closed without sufficient history or variation",()=>{
 assert.equal(computeIvRank(.3,[.2,.3]),null);
 assert.equal(computeIvRank(.3,Array(252).fill(.3)),null);
});
