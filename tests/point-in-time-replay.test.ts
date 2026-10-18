import test from "node:test";import assert from "node:assert/strict";import {knownAtCutoff} from "../lib/market/replay";
const b=(t:string,c:number)=>({t,c,o:c,h:c,l:c,v:1});
test("Replay never includes a candle that has not closed by the historical cutoff",()=>{
 const bars=[b("2026-10-16T14:50:00Z",98),b("2026-10-16T14:55:00Z",99),b("2026-10-16T15:00:00Z",100),b("2026-10-16T15:05:00Z",101)];
 const known=knownAtCutoff(bars,Date.parse("2026-10-16T15:00:00Z"),5);
 assert.deepEqual(known.map(x=>x.c),[98,99]);
});
test("Replay returns bars in chronological order",()=>assert.deepEqual(knownAtCutoff([b("2026-10-16T14:55:00Z",2),b("2026-10-16T14:50:00Z",1)],Date.parse("2026-10-16T15:00:00Z")).map(x=>x.c),[1,2]));
