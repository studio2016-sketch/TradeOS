import test from "node:test";import assert from "node:assert/strict";
import {reconcileAccountSnapshot} from "../lib/research/portfolioReconciliation";
import type {BrokerAccountState} from "../lib/broker/alpaca";
const state={environment:"paper",equity:1100,portfolioValue:1100,cash:1000,lastEquity:1080,buyingPower:2000,positions:[{symbol:"TEST",qty:1,side:"long",marketValue:100,costBasis:90,unrealizedPl:10,unrealizedPlpc:.11,currentPrice:100}],openOrders:[],generatedAt:new Date().toISOString()} as unknown as BrokerAccountState;
test("Paper account snapshot reconciles reported equity, long P&L and marked positions",()=>{const x=reconcileAccountSnapshot(state);assert.equal(x.status,"PASS");assert.equal(x.noTransactionsReconciled,true)});
test("Mismatch cannot be reported as certified",()=>{const x=reconcileAccountSnapshot({...state,equity:1250});assert.equal(x.status,"REVIEW");assert.ok(x.checks.some(c=>c.state==="REVIEW"))});
test("Absent values remain unavailable rather than fictional zero",()=>{const x=reconcileAccountSnapshot({...state,cash:null});assert.equal(x.status,"UNAVAILABLE")});
