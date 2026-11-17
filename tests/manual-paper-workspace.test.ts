import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaperWorkspace from "../app/paper-workspace/PaperWorkspace";

test("workspace renders five labeled blank inputs and a disabled initial save", () => {
  const html = renderToStaticMarkup(createElement(PaperWorkspace));
  assert.equal((html.match(/<input /g) || []).length, 5);
  assert.equal((html.match(/value=""/g) || []).length, 5);
  for (const field of ["equity", "riskPercent", "entry", "stop", "target"]) {
    assert.match(html, new RegExp(`for="paper-${field}"`));
    assert.match(html, new RegExp(`id="paper-${field}"`));
    assert.match(html, new RegExp(`aria-describedby="paper-${field}-help"`));
  }
  assert.match(html, /disabled="">Save arithmetic draft on this page/);
  assert.match(html, /No arithmetic drafts saved/);
  assert.doesNotMatch(html, /class="paperShares"/);
});

test("rendered workspace states the local-only scope and stop-loss limitations", () => {
  const html = renderToStaticMarkup(createElement(PaperWorkspace));
  assert.match(html, /Use hypothetical numbers only/);
  assert.match(html, /Planned stop loss is not a maximum loss/);
  assert.match(html, /No fills or protective orders exist here/);
  assert.match(html, /Not uploaded or written to browser storage/);
  assert.match(html, /sizes are not added into a portfolio/);
  assert.match(html, /does not check market evidence, portfolio holdings, daily loss limits or execution readiness/);
  assert.match(html, /scientific certification/);
});
