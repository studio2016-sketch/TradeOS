import assert from "node:assert/strict";
import test from "node:test";
import {
  createResearchPanelLoader, hasCurrentResearchResponse, initialResearchPanels,
  RESEARCH_PANELS, researchPanelStatus, type ResearchPanels,
} from "../lib/research/research-panel-loader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const validDataset = {
  status: "RESEARCH_ONLY", validations: [], associations: [], rule: {}, summary: {}, recent: [],
  modelPromotionAllowed: false, liveExecutionAllowed: false, checks: [],
};
function response(data: unknown = {}, status = 200) {
  const body = data && typeof data === "object" && !Array.isArray(data) ? { ...validDataset, ...data } : data;
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function setup(fetcher: typeof fetch, options: { now?: () => number; timeoutMs?: number } = {}) {
  let panels = initialResearchPanels();
  const changes: ResearchPanels[] = [];
  const loader = createResearchPanelLoader(next => { panels = next; changes.push(next); }, { fetcher, ...options });
  return { ...loader, get panels() { return panels; }, changes };
}

test("every panel begins without invented successful evidence or an available certification", () => {
  for (const panel of Object.values(initialResearchPanels())) {
    assert.equal(panel.data, null);
    assert.equal(panel.lastSuccessAt, null);
    assert.equal(researchPanelStatus(panel), "Not loaded yet.");
    assert.equal(hasCurrentResearchResponse(panel), false);
  }
});

test("a slow or HTTP-failing panel does not withhold three successful panels", async () => {
  const ledger = deferred<Response>();
  const signals: AbortSignal[] = [];
  const loader = setup(async (url, init) => {
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    signals.push(init.signal);
    return url === RESEARCH_PANELS.ledger.url ? ledger.promise : response({ dataset: String(url) });
  }, { now: () => 1234 });
  const run = loader.refresh();
  assert.ok(Object.values(loader.panels).every(panel => panel.loading));
  await flush();
  for (const key of ["models", "factors", "certification"] as const) {
    assert.equal(loader.panels[key].loading, false);
    assert.equal(loader.panels[key].data?.dataset, RESEARCH_PANELS[key].url);
    assert.equal(loader.panels[key].lastSuccessAt, 1234);
  }
  assert.equal(loader.panels.ledger.loading, true);
  ledger.resolve(response({ reason: "unavailable" }, 503));
  await run;
  assert.match(loader.panels.ledger.error!, /HTTP 503/);
  assert.match(researchPanelStatus(loader.panels.ledger), /UNAVAILABLE/);
  assert.equal(loader.panels.ledger.data, null);
  assert.equal(loader.panels.ledger.lastSuccessAt, null);
  assert.ok(signals.every(signal => !signal.aborted));
});

test("network, invalid JSON, and unavailable-envelope failures remain local to their panels", async () => {
  const loader = setup(async url => {
    if (url === RESEARCH_PANELS.models.url) throw new Error("Offline");
    if (url === RESEARCH_PANELS.factors.url) return new Response("<html>upstream error</html>");
    if (url === RESEARCH_PANELS.ledger.url) return response({ status: "UNAVAILABLE" });
    return response({ status: "BLOCKED", modelPromotionAllowed: false });
  });
  await loader.refresh();
  assert.equal(loader.panels.models.error, "Offline");
  assert.ok(loader.panels.factors.error);
  assert.ok(loader.panels.ledger.error);
  assert.equal(loader.panels.certification.error, null);
  assert.equal(loader.panels.certification.data?.status, "BLOCKED");
  assert.ok(Object.values(loader.panels).every(panel => !panel.loading));
});

test("null, array, primitive, and error-only JSON never replace a successful response", async () => {
  for (const invalid of [null, [], "not a dataset", 0, { error: "upstream" }]) {
    let valid = true;
    const loader = setup(async () => response(valid ? { sample: "retained" } : invalid), { now: () => 123 });
    await loader.refresh();
    valid = false;
    await loader.refresh();
    for (const panel of Object.values(loader.panels)) {
      assert.equal(panel.data?.sample, "retained");
      assert.equal(panel.lastSuccessAt, 123);
      assert.ok(panel.error);
      assert.match(researchPanelStatus(panel), /STALE/);
    }
  }
});

test("failed rechecks retain visibly stale data and time; recovery replaces only successful data", async () => {
  let round = 1;
  const loader = setup(async url => {
    if (round === 2 && url === RESEARCH_PANELS.certification.url) return response({}, 503);
    return response({ round, status: "INDEPENDENTLY_VALIDATED", certified: true, modelPromotionAllowed: true, checks: [{ id: "fixture", pass: true, detail: "Fixture only" }] });
  }, { now: () => round * 1000 });
  await loader.refresh();
  const firstCertification = loader.panels.certification.data;
  assert.equal(hasCurrentResearchResponse(loader.panels.certification), true);
  round = 2;
  const recheck = loader.refresh();
  assert.equal(hasCurrentResearchResponse(loader.panels.certification), false);
  assert.match(researchPanelStatus(loader.panels.certification), /Showing the last successful response/);
  await recheck;
  assert.equal(loader.panels.certification.data, firstCertification);
  assert.equal(loader.panels.certification.lastSuccessAt, 1000);
  assert.match(researchPanelStatus(loader.panels.certification), /STALE/);
  assert.equal(hasCurrentResearchResponse(loader.panels.certification), false);
  assert.equal(loader.panels.models.data?.round, 2);
  assert.equal(loader.panels.models.lastSuccessAt, 2000);
  round = 3;
  await loader.refresh();
  assert.equal(loader.panels.certification.data?.round, 3);
  assert.equal(loader.panels.certification.lastSuccessAt, 3000);
  assert.equal(loader.panels.certification.error, null);
  assert.equal(hasCurrentResearchResponse(loader.panels.certification), true);
});

test("repeated synchronous clicks coalesce into exactly one four-request refresh", async () => {
  const wait = deferred<void>();
  let requests = 0;
  const loader = setup(async () => { requests++; await wait.promise; return response(); });
  const first = loader.refresh();
  assert.equal(loader.refresh(), first);
  assert.equal(loader.refresh(), first);
  assert.equal(requests, 4);
  wait.resolve();
  await first;
  await loader.refresh();
  assert.equal(requests, 8);
});

test("cancellation aborts all requests and suppresses updates even when fetch ignores abort", async () => {
  const wait = deferred<void>();
  const signals: AbortSignal[] = [];
  const loader = setup(async (_, init) => {
    signals.push(init!.signal!);
    await wait.promise;
    return response({ obsolete: true });
  });
  const old = loader.refresh();
  const beforeCancel = loader.changes.length;
  loader.cancel();
  await old;
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(loader.changes.length, beforeCancel);
  wait.resolve();
  await flush();
  assert.equal(loader.changes.length, beforeCancel);
});

test("an old cancelled generation cannot overwrite a newer result or clear its click guard", async () => {
  const oldWait = deferred<void>(), newWait = deferred<void>();
  let requests = 0;
  const loader = setup(async () => {
    const round = requests++ < 4 ? 1 : 2;
    await (round === 1 ? oldWait.promise : newWait.promise);
    return response({ round });
  });
  const oldRun = loader.refresh();
  loader.cancel();
  const newRun = loader.refresh();
  await oldRun;
  assert.equal(loader.refresh(), newRun);
  assert.equal(requests, 8);
  newWait.resolve();
  await newRun;
  oldWait.resolve();
  await flush();
  assert.ok(Object.values(loader.panels).every(panel => panel.data?.round === 2 && !panel.loading));
});

test("a hung request times out independently, aborts, and can be retried", async () => {
  let hanging = true;
  let hungSignal: AbortSignal | null = null;
  const loader = setup(async (url, init) => {
    if (hanging && url === RESEARCH_PANELS.ledger.url) {
      hungSignal = init!.signal!;
      return new Promise<Response>(() => {});
    }
    return response();
  }, { timeoutMs: 15 });
  await loader.refresh();
  assert.equal((hungSignal as AbortSignal | null)?.aborted, true);
  assert.match(loader.panels.ledger.error!, /timed out/);
  assert.equal(loader.panels.models.error, null);
  assert.ok(Object.values(loader.panels).every(panel => !panel.loading));
  hanging = false;
  await loader.refresh();
  assert.equal(loader.panels.ledger.error, null);
  assert.ok(loader.panels.ledger.data);
});

test("a stalled JSON body also times out rather than holding all panels busy", async () => {
  const body = deferred<unknown>();
  const loader = setup(async url => url === RESEARCH_PANELS.factors.url
    ? { ok: true, json: () => body.promise } as Response
    : response(), { timeoutMs: 15 });
  await loader.refresh();
  assert.match(loader.panels.factors.error!, /timed out/);
  assert.equal(loader.panels.ledger.error, null);
  const changes = loader.changes.length;
  body.resolve({ late: true });
  await flush();
  assert.equal(loader.changes.length, changes);
});

test("malformed nested containers fail only their own panel before reaching React", async () => {
  const cases = [
    { key: "models", value: { validations: "bad" } },
    { key: "models", value: { validations: [null] } },
    { key: "models", value: { validations: [{ modelAndHorizon: "x", warnings: [{}] }] } },
    { key: "factors", value: { associations: "bad" } },
    { key: "factors", value: { historicalDiscovery: { findings: "bad" } } },
    { key: "factors", value: { historicalDiscovery: { findings: [{ label: 123, status: "x" }] } } },
    { key: "factors", value: { factorDependence: { pairs: "bad" } } },
    { key: "ledger", value: { recent: "bad" } },
    { key: "ledger", value: { recent: [null] } },
    { key: "ledger", value: { rule: { fingerprint: {} } } },
    { key: "ledger", value: { summary: { passes: {} } } },
    { key: "ledger", value: { prospectiveFactorAssociations: { findings: "bad" } } },
    { key: "certification", value: { checks: "bad" } },
    { key: "certification", value: { checks: [{ id: null, pass: false }] } },
  ] as const;
  for (const { key, value } of cases) {
    const loader = setup(async url => response(url === RESEARCH_PANELS[key].url ? value : {}));
    await loader.refresh();
    assert.ok(loader.panels[key].error, `${key} should reject ${JSON.stringify(value)}`);
    assert.equal(loader.panels[key].data, null);
    for (const other of Object.keys(RESEARCH_PANELS) as (keyof typeof RESEARCH_PANELS)[]) {
      if (other !== key) assert.equal(loader.panels[other].error, null, `${other} must stay available`);
    }
  }
});

test("missing or truthy non-boolean certification flags never become current permissions", async () => {
  for (const flags of [{}, { modelPromotionAllowed: "false", liveExecutionAllowed: "true" }, { modelPromotionAllowed: true }]) {
    const loader = setup(async url => url === RESEARCH_PANELS.certification.url
      ? Response.json({ status: "FIXTURE_ONLY", checks: [], ...flags })
      : response());
    await loader.refresh();
    assert.ok(loader.panels.certification.error);
    assert.equal(hasCurrentResearchResponse(loader.panels.certification), false);
    assert.equal(loader.panels.models.error, null);
  }
});

test("valid nonempty rendered rows pass the structural guard without changing their scientific content", async () => {
  const rows = {
    models: { validations: [{ modelAndHorizon: "frozen | 1h", sampleCount: 10, trainCount: 7, holdoutCount: 3, evidenceOfImprovement: false, warnings: ["Research only"] }] },
    factors: {
      associations: [{ label: "factor", recorded: 10, holdout: 3, highCount: 2, lowCount: 1 }],
      historicalDiscovery: { findings: [{ label: "factor", status: "RESEARCH_ONLY", direction: "positive", observations: 10, sessions: 3, symbols: 2 }] },
      factorDependence: { pairs: [{ first: "a", second: "b", pearsonR: 0.5, paired: 10, status: "DESCRIPTIVE" }] },
    },
    ledger: {
      rule: { version: "frozen", fingerprint: "abc" },
      recent: [{ id: "1", verdict: "UNRESOLVED", symbol: "SPY", horizon: "1h", forecastAt: "2026-11-08T12:00:00Z", evidenceClass: "HISTORICAL_RECONSTRUCTION", scientificallyEligible: false }],
      prospectiveFactorAssociations: { findings: [{ label: "factor", observations: 10, sessions: 3, status: "RESEARCH_ONLY" }] },
    },
    certification: { status: "BLOCKED", modelPromotionAllowed: false, liveExecutionAllowed: false, checks: [{ id: "evidence", pass: false, detail: "More evidence required" }] },
  };
  const loader = setup(async url => {
    const key = (Object.keys(RESEARCH_PANELS) as (keyof typeof RESEARCH_PANELS)[]).find(key => RESEARCH_PANELS[key].url === url)!;
    return response(rows[key]);
  });
  await loader.refresh();
  for (const panel of Object.values(loader.panels)) assert.equal(panel.error, null);
  assert.equal(loader.panels.certification.data?.modelPromotionAllowed, false);
  assert.equal(loader.panels.ledger.data?.recent[0].scientificallyEligible, false);
});

test("contradictory certification refreshes preserve stale evidence without current permissions", async () => {
  const invalid = [
    { status: "BLOCKED", modelPromotionAllowed: true },
    { liveExecutionAllowed: true },
    { status: "INDEPENDENTLY_VALIDATED", certified: true, modelPromotionAllowed: true, checks: [] },
    { status: "INDEPENDENTLY_VALIDATED", certified: true, modelPromotionAllowed: true, checks: [{ id: "evidence", pass: false, detail: "Failed" }] },
    { status: "INDEPENDENTLY_VALIDATED", modelPromotionAllowed: false },
    { status: "BLOCKED", certified: true },
    { status: "UNKNOWN" },
  ];
  for (const malformed of invalid) {
    let round = 1;
    const loader = setup(async url => response(round === 2 && url === RESEARCH_PANELS.certification.url ? malformed : {}), { now: () => round });
    await loader.refresh();
    const previous = loader.panels.certification.data;
    round = 2;
    await loader.refresh();
    assert.ok(loader.panels.certification.error, JSON.stringify(malformed));
    assert.equal(loader.panels.certification.data, previous);
    assert.equal(loader.panels.certification.lastSuccessAt, 1);
    assert.match(researchPanelStatus(loader.panels.certification), /STALE/);
    assert.equal(hasCurrentResearchResponse(loader.panels.certification), false);
    assert.equal(loader.panels.models.error, null);
    round = 3;
    await loader.refresh();
    assert.equal(loader.panels.certification.error, null);
    assert.equal(loader.panels.certification.lastSuccessAt, 3);
  }
});

test("malformed counts stay local and cannot replace previous research measurements", async () => {
  for (const value of ["banana", true, -1, 1.5, 1e100]) {
    let malformed = false;
    const loader = setup(async url => response(malformed && url === RESEARCH_PANELS.models.url
      ? { validations: [{ modelAndHorizon: "fixture", sampleCount: value }] }
      : malformed && url === RESEARCH_PANELS.ledger.url ? { summary: { passes: value } } : {}));
    await loader.refresh();
    const previous = loader.panels.models.data;
    malformed = true;
    await loader.refresh();
    assert.ok(loader.panels.models.error);
    assert.ok(loader.panels.ledger.error);
    assert.equal(loader.panels.models.data, previous);
    assert.equal(loader.panels.certification.error, null);
    assert.equal(loader.panels.factors.error, null);
  }
});

