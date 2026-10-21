import test from "node:test";import assert from "node:assert/strict";
import {auditEvidence} from "../lib/research/source-vintage-audit.ts";
const base={factor:"daily_volume",value:100,domain:"stock",source:"Alpaca",subject:"NVDA",observedAt:"2026-10-20T14:00:00Z",availableAt:"2026-10-20T14:01:00Z"};
test("rejects data released after decision",()=>assert.equal(auditEvidence([{...base,availableAt:"2026-10-20T14:03:00Z"}],"2026-10-20T14:02:00Z").measured,0));
test("counts repeated measures of same factor once",()=>assert.equal(auditEvidence([base,base],"2026-10-20T14:02:00Z").measured,1));
test("requires plausible available-at timestamp",()=>assert.equal(auditEvidence([{...base,availableAt:"2026-10-20T13:59:00Z"}],"2026-10-20T14:02:00Z").measured,0));
