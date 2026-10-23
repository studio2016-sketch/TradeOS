import test from "node:test";
import assert from "node:assert/strict";
import {ALPACA_IEX_TIME_EVIDENCE,alpacaIexEvidenceSha256,sourceTimeCertificateCovers} from "../lib/research/source-time-certification.ts";

const certificate={provider:"alpaca",feed:"iex",certification_kind:"exchange_authoritative_timestamp",valid_from:"2026-10-23T08:00:00Z",valid_to:null,created_at:"2026-10-23T08:00:00Z"};
test("source-time evidence is pinned to distinct venue and distributor specifications",()=>{
 assert.equal(ALPACA_IEX_TIME_EVIDENCE.documents.length,3);
 assert.equal(new Set(ALPACA_IEX_TIME_EVIDENCE.documents.map(x=>x.authority)).size,2);
 assert.match(alpacaIexEvidenceSha256(),/^[a-f0-9]{64}$/);
});
test("a source-time certificate never grants retrospective credit",()=>{
 assert.equal(sourceTimeCertificateCovers("Alpaca:iex","2026-10-23T07:59:59Z",certificate),false);
 assert.equal(sourceTimeCertificateCovers("Alpaca:iex","2026-10-23T08:00:00Z",certificate),true);
 assert.equal(sourceTimeCertificateCovers("Alpaca:delayed_sip","2026-10-23T08:01:00Z",certificate),false);
});
