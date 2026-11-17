import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DecisionOverview, {
  observationLabel,
  count,
} from "../app/components/DecisionOverview";
import { readFileSync } from "node:fs";
const base = {
  symbol: "NVDA",
  alignment: null,
  health: null,
  market: null,
  intelligence: null,
  refreshing: false,
  lastRefresh: null,
  onNavigate: () => {},
  onSelect: () => {},
};
test("empty research desk does not turn missing data into readiness", () => {
  const html = renderToStaticMarkup(<DecisionOverview {...base} />);
  for (const text of [
    "Execution stays locked",
    "Not established",
    "Assessment not available yet",
    "Source report unavailable",
    "Observation time unavailable",
    "not verified accuracy",
    "Not a certified success rate",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("$0.00"));
});
test("observed data remains labeled and all workflow destinations exist", () => {
  const html = renderToStaticMarkup(
    <DecisionOverview
      {...base}
      alignment={{
        canonical: { observedTotal: 73 },
        readings: [{ id: "x", label: "Evidence absent", state: "unavailable" }],
      }}
      market={{
        snapshots: [
          {
            symbol: "NVDA",
            price: 123.45,
            timestamp: "2026-11-17T12:00:00Z",
            source: "Test IEX",
          },
        ],
      }}
      health={{
        metrics: { observations: 0 },
        reliability: {
          rows: [
            {
              id: "x",
              label: "Test",
              freshness: "stale",
              decisionGrade: false,
            },
          ],
        },
      }}
    />,
  );
  for (const text of [
    "73",
    "$123.45",
    "Test IEX",
    "Evidence absent",
    "stale",
    "Limited / unverified",
    "/live-board",
    "/research-lab",
    "/operations",
    "/knowledge-graph",
    "/week-one",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/aria-label="Analyze NVDA"/g) || []).length, 1);
});
test("invalid dates and nonfinite observations stay unavailable", () => {
  assert.equal(observationLabel("not-a-date"), "Observation time unavailable");
  assert.equal(observationLabel(null), "Observation time unavailable");
  const html = renderToStaticMarkup(
    <DecisionOverview
      {...base}
      alignment={{ canonical: { observedTotal: NaN } }}
      health={{ metrics: { forecasts: Infinity } }}
    />,
  );
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
});
test("redesign preserves every existing home section and adds navigable accessible shell", () => {
  const source = readFileSync(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  for (const section of [
    "Today",
    "Discover",
    "Analyze",
    "Trade",
    "Learn",
    "Replay",
    "News",
    "Edge Lab",
    "Alignment",
    "Journal",
  ])
    assert.ok(source.includes(`active==="${section}"`));
  for (const text of [
    "Skip to workspace",
    "aria-current",
    "aria-expanded={mobileMore}",
    "Extended market & research detail",
    "Educational guidance · not a live market assessment",
  ])
    assert.ok(source.includes(text));
});

test("raw database bigint count strings display without coercing malformed values", () => {
  assert.equal(count("12345"), "12,345");
  assert.equal(count("0"), "0");
  for (const invalid of [
    "",
    " 12",
    "1e3",
    "12.5",
    "-1",
    "9007199254740992",
    -1,
    1.5,
    null,
  ])
    assert.equal(count(invalid), "—");
  const html = renderToStaticMarkup(
    <DecisionOverview
      {...base}
      health={{ metrics: { observations: "12345", forecasts: "321" } }}
    />,
  );
  assert.ok(html.includes("12,345"));
  assert.ok(html.includes("321"));
});
