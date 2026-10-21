import test from "node:test";
import assert from "node:assert/strict";
import {parseReportedSurprises,parseEarningsDate,guidanceDirection,customerEventDirection,isUnambiguousIssuerArticle} from "../lib/research/marketwide-event-evidence.ts";

test("market-wide event parser extracts explicit reported EPS and revenue surprises",()=>{
 const out=parseReportedSurprises("Q3 EPS $1.43 Misses $1.65 Estimate, Sales $79.704M Miss $80.200M Estimate");
 assert.ok(out.eps&&out.revenue);
 assert.ok(Math.abs(out.eps.surprise-((1.43-1.65)/1.65))<1e-12);
 assert.ok(Math.abs(out.revenue.surprise-((79.704-80.2)/80.2))<1e-12);
});
test("earnings date parser uses an explicit future calendar date",()=>{
 const out=parseEarningsDate("The company will release its Q3 2026 earnings on November 4, 2026.","2026-10-21T12:00:00Z");
 assert.equal(out?.scheduledDate,"2026-11-04");
 assert.ok(out&&out.daysToEarnings>13&&out.daysToEarnings<15);
});
test("guidance parser distinguishes raised lowered and explicitly maintained guidance",()=>{
 assert.equal(guidanceDirection("Company raises full-year guidance"),1);
 assert.equal(guidanceDirection("Company cuts revenue outlook"),-1);
 assert.equal(guidanceDirection("Full-year 2026 guidance maintained"),0);
 assert.equal(guidanceDirection("Management discussed demand"),null);
});

test("customer event parser requires explicit win or loss language",()=>{
 assert.equal(customerEventDirection("The company disclosed the loss of a major customer (Chime)."),-1);
 assert.equal(customerEventDirection("The company secured a new customer contract."),1);
 assert.equal(customerEventDirection("Management discussed customer acquisition."),null);
});

test("issuer event attribution rejects ambiguous multi-symbol articles",()=>{
 assert.equal(isUnambiguousIssuerArticle(["CTBI"]),true);
 assert.equal(isUnambiguousIssuerArticle(["GOOG","GOOGL","MSFT"]),false);
});
