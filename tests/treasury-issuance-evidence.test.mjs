import test from "node:test";
import assert from "node:assert/strict";
import {trailingAcceptedIssuance} from "../lib/research/treasury-issuance-evidence.ts";

test("Treasury issuance sums accepted auction amounts in the trailing seven-day window",()=>{
 const now=new Date("2026-10-21T12:00:00Z");
 const out=trailingAcceptedIssuance([
  {auction_date:"2026-10-21",cusip:"A",total_accepted:"50000000000"},
  {auction_date:"2026-10-17",cusip:"B",total_accepted:"42000000000"},
  {auction_date:"2026-10-10",cusip:"OLD",total_accepted:"99000000000"}
 ],now,7);
 assert.equal(out?.value,92000000000);
 assert.equal(out?.count,2);
 assert.deepEqual(out?.cusips,["A","B"]);
});
test("Treasury issuance fails closed when no eligible auction result exists",()=>{
 const out=trailingAcceptedIssuance([{auction_date:"2026-10-21",total_accepted:"null"}],new Date("2026-10-21T12:00:00Z"),7);
 assert.equal(out,null);
});
