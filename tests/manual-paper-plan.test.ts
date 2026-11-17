import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addSessionDraft, calculateManualPlan, createSessionDraft, EMPTY_MANUAL_PLAN,
  MAX_MANUAL_SHARES, MAX_SESSION_DRAFTS, type ManualPlanInputs,
} from "../lib/paper/manualPlan";

const example: ManualPlanInputs = { equity: "10000", riskPercent: "1", entry: "100", stop: "98", target: "104" };
const plan = (overrides: Partial<ManualPlanInputs> = {}) => {
  const result = calculateManualPlan({ ...example, ...overrides });
  assert.equal(result.status, "sized");
  assert.ok(result.plan);
  return result.plan;
};

test("blank or malformed input never manufactures a size", () => {
  const blank = calculateManualPlan(EMPTY_MANUAL_PLAN);
  assert.equal(blank.status, "incomplete");
  assert.equal(blank.plan, null);
  for (const input of [null, undefined, [], "10000", 10000, { ...example, equity: 10000 }]) {
    assert.equal(calculateManualPlan(input).status, "invalid");
    assert.equal(calculateManualPlan(input).plan, null);
  }
});

test("manual equity and percentage produce risk-limited whole shares", () => {
  assert.deepEqual(plan(), {
    shares: 50, riskBudget: "100.00", riskPerShare: "2.00", notional: "5000.00",
    plannedStopLoss: "100.00", targetGain: "200.00", remainingEquity: "5000.00",
    rewardToRisk: "2", limitingFactors: ["Chosen risk budget"],
  });
  assert.equal(plan({ riskPercent: "0.5" }).shares, 25);
  assert.equal(plan({ equity: "20000" }).shares, 100);
});

test("equity caps size even when a large risk percentage permits more shares", () => {
  const result = plan({ equity: "1000", riskPercent: "100", entry: "300", stop: "299", target: "303" });
  assert.equal(result.shares, 3);
  assert.equal(result.notional, "900.00");
  assert.equal(result.plannedStopLoss, "3.00");
  assert.equal(result.remainingEquity, "100.00");
  assert.deepEqual(result.limitingFactors, ["Hypothetical equity (no borrowing)"]);
});

test("ties report both limiting assumptions and enforce the quantity bound", () => {
  assert.deepEqual(plan({ equity: "100", riskPercent: "50", entry: "10", stop: "5", target: "20" }).limitingFactors,
    ["Chosen risk budget", "Hypothetical equity (no borrowing)"]);
  const result = plan({ equity: "1000000000", riskPercent: "100", entry: "1", stop: "0.9999", target: "2" });
  assert.equal(result.shares, MAX_MANUAL_SHARES);
  assert.deepEqual(result.limitingFactors, ["100,000-share calculator limit"]);
});

test("exact decimal arithmetic does not lose a whole share at decimal boundaries", () => {
  const result = plan({ equity: "100", riskPercent: "0.3", entry: "0.3", stop: "0.2", target: "0.6" });
  assert.equal(result.shares, 3);
  assert.equal(result.plannedStopLoss, "0.30");
  assert.equal(result.notional, "0.90");
  assert.equal(result.targetGain, "0.90");
});

test("risk budget floors to cents without rounding upward", () => {
  const result = plan({ equity: "100.99", riskPercent: "1", entry: "1", stop: "0.6667", target: "2" });
  assert.equal(result.riskBudget, "1.00");
  assert.equal(result.shares, 3);
  assert.equal(result.plannedStopLoss, "0.9999");
});

test("sub-cent amounts and tiny nonzero reward ratios remain visible", () => {
  const result = plan({ equity: "1", riskPercent: "1", entry: "1", stop: "0.9999", target: "1.0001" });
  assert.equal(result.plannedStopLoss, "0.0001");
  assert.equal(result.targetGain, "0.0001");
  const tinyRatio = plan({ equity: "1000000", riskPercent: "100", entry: "999999.9999", stop: "0.0001", target: "1000000" });
  assert.ok(Number(tinyRatio.rewardToRisk) > 0);
});

test("zero shares is explicit and cannot create a journal draft", () => {
  for (const overrides of [{ equity: "1", entry: "100" }, { riskPercent: "0.0001", equity: "0.01" }]) {
    const inputs = { ...example, ...overrides };
    const result = calculateManualPlan(inputs);
    assert.equal(result.status, "zero_shares");
    assert.equal(result.plan?.shares, 0);
    assert.equal(createSessionDraft(inputs), null);
  }
});

test("rejects invalid numbers, excess precision, locale ambiguity and unsupported ranges", () => {
  for (const bad of ["0", "-1", "NaN", "Infinity", "1e3", "0x10", "1,000", "1,43", "1_000", "+1", ".1", "1.", "1.00001", "9".repeat(100)]) {
    const result = calculateManualPlan({ ...example, riskPercent: bad });
    assert.equal(result.status, "invalid", bad);
    assert.equal(result.plan, null);
  }
  for (const overrides of [{ equity: "1000000000.01" }, { equity: "10.001" }, { entry: "1000000.0001" }, { riskPercent: "100.0001" }]) {
    assert.equal(calculateManualPlan({ ...example, ...overrides }).status, "invalid");
  }
});

test("a stop at or above entry and a target at or below entry fail closed", () => {
  for (const overrides of [{ stop: "100" }, { stop: "101" }, { target: "100" }, { target: "99" }]) {
    assert.equal(calculateManualPlan({ ...example, ...overrides }).status, "invalid");
  }
});

test("all outcomes preserve non-execution and non-certification scope", () => {
  for (const inputs of [example, EMPTY_MANUAL_PLAN, { ...example, stop: "100" }, { ...example, equity: "1" }]) {
    const result = calculateManualPlan(inputs);
    assert.equal(result.source, "manual_hypothetical");
    assert.equal(result.paperOnly, true);
    assert.equal(result.liveAuthorized, false);
    assert.equal(result.fillSimulated, false);
    assert.equal(result.certified, false);
  }
});

test("session drafts are copied, canonicalized and deduplicated without mutation", () => {
  const inputs = { ...example };
  const original: ReturnType<typeof addSessionDraft> = [];
  const drafts = addSessionDraft(original, inputs);
  assert.equal(original.length, 0);
  inputs.equity = "999";
  assert.equal(drafts[0].inputs.equity, "10000.00");
  assert.equal(drafts[0].plan.shares, 50);
  assert.equal(addSessionDraft(drafts, { ...example, equity: "0010000.00", riskPercent: " 01.0000 " }), drafts);
  assert.equal(addSessionDraft(drafts, EMPTY_MANUAL_PLAN), drafts);
});

test("journal reaches its bound without silently replacing earlier snapshots", () => {
  let drafts: ReturnType<typeof addSessionDraft> = [];
  for (let index = 0; index < MAX_SESSION_DRAFTS; index++) drafts = addSessionDraft(drafts, { ...example, target: String(104 + index) });
  assert.equal(drafts.length, MAX_SESSION_DRAFTS);
  assert.equal(addSessionDraft(drafts, { ...example, target: "999" }), drafts);
  assert.equal(drafts[0].inputs.target, "104.00");
});

test("integer reference sweep preserves risk, cash and whole-share limits", () => {
  // Independently derive cents-based expectations without the production parser.
  // These 400 exact-cent scenarios include cash limits, risk limits and zero sizes.
  for (let i = 1; i <= 400; i++) {
    const equityCents = 50 + i * 17;
    const entryCents = 20 + (i % 47) * 3;
    const stopCents = entryCents - (1 + i % 19);
    const riskPercent = 1 + i % 100;
    const budgetCents = Math.floor(equityCents * riskPercent / 100);
    const expected = Math.min(Math.floor(budgetCents / (entryCents - stopCents)), Math.floor(equityCents / entryCents), MAX_MANUAL_SHARES);
    const result = calculateManualPlan({ equity: (equityCents / 100).toFixed(2), riskPercent: String(riskPercent), entry: (entryCents / 100).toFixed(2), stop: (stopCents / 100).toFixed(2), target: ((entryCents + 10) / 100).toFixed(2) });
    assert.ok(result.plan);
    assert.equal(result.plan.shares, expected, `scenario ${i}`);
    assert.ok(Math.round(Number(result.plan.plannedStopLoss) * 100) <= budgetCents);
    assert.ok(Math.round(Number(result.plan.notional) * 100) <= equityCents);
  }
});

test("planner module and page have no data-fetch, broker or browser-storage path", () => {
  for (const path of ["lib/paper/manualPlan.ts", "app/paper-workspace/page.tsx", "app/paper-workspace/PaperWorkspace.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|\.\/.*broker|\.\/.*market|\.\/.*db/);
  }
  const home = readFileSync("app/page.tsx", "utf8");
  assert.match(home, /href="\/paper-workspace"/);
  assert.doesNotMatch(home, /const calc=useMemo|Planned worst case/);
  assert.match(home, /Daily-loss-limit status/);
  assert.match(home, /Stop-order readiness/);
  const bridge = readFileSync("app/api/research-paper/route.ts", "utf8");
  assert.match(bridge, /quantity:1/);
  assert.match(bridge, /equity:10000/);
  assert.match(bridge, /illustrative one-share risk assumptions/);
});
