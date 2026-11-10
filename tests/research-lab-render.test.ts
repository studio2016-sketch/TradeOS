import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ResearchLab from "../app/research-lab/page";

test("initial Research Lab distinguishes unavailable evidence from measured zero or empty findings", () => {
  const html = renderToStaticMarkup(createElement(ResearchLab));
  assert.equal((html.match(/Last successful load: Never/g) ?? []).length, 4);
  assert.equal((html.match(/load status/g) ?? []).length, 4);
  assert.match(html, /Prospective PASS\/FAIL: <strong>—\/—<\/strong>/);
  assert.match(html, /Prospective sessions: <strong>—<\/strong>/);
  assert.match(html, /Fingerprint-bound records: <strong>—<\/strong>/);
  assert.match(html, /Model promotion: <strong>UNAVAILABLE<\/strong>/);
  assert.match(html, /Live execution: <strong>UNAVAILABLE<\/strong>/);
  assert.doesNotMatch(html, /No independently evaluable models returned/);
  assert.doesNotMatch(html, /No factor hypothesis can be formed/);
  assert.doesNotMatch(html, /Factor outcomes unavailable/);
});

test("scientific warnings and fail-closed research statements remain in the page", () => {
  const html = renderToStaticMarkup(createElement(ResearchLab));
  assert.match(html, /not independent proof of profitable trading/);
  assert.match(html, /descriptive, not independent predictive validation/);
  assert.match(html, /Missing historical evidence cannot be manufactured/);
  assert.match(html, /Load time does not establish source freshness or scientific certification/);
});
