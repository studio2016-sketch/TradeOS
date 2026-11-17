import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudyPath, {
  studyLessons,
  studyProgress,
} from "../app/components/StudyPath";
import { readFileSync } from "node:fs";
test("study begins with zero progress and clear nonfinancial limits", () => {
  const html = renderToStaticMarkup(<StudyPath onExplore={() => {}} />);
  for (const text of [
    "Small discoveries",
    "No trades needed",
    "no streak",
    "ideas practiced",
    "resets when you reload",
    "not investment skill",
    "never changes TradeOS safeguards",
    'value="0"',
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes("<fieldset>"));
  assert.equal((html.match(/type="radio"/g) || []).length, 3);
});
test("only unique valid study ideas count, never actions or money", () => {
  assert.equal(studyProgress([]), 0);
  assert.equal(studyProgress(["sources", "sources", "buy", "profit"]), 1);
  assert.equal(studyProgress(studyLessons.map((x) => x.id)), 3);
  for (const lesson of studyLessons) {
    assert.ok(lesson.answer >= 0 && lesson.answer < lesson.options.length);
    assert.ok(lesson.explanation.length > 50);
  }
});
test("study component cannot call financial APIs, persist tracking or introduce countdown pressure", () => {
  const source = readFileSync(
    new URL("../app/components/StudyPath.tsx", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "fetch(",
    "localStorage",
    "sessionStorage",
    "setInterval",
    "Date.now",
    "Math.random",
  ])
    assert.ok(!source.includes(forbidden), forbidden);
  assert.match(source, /choice === lesson.answer/);
  assert.match(source, /previous.includes\(lesson.id\)/);
});

test("light learning tiles override legacy mint captions", () => {
  const css = readFileSync(new URL("../app/enterprise.css", import.meta.url), "utf8");
  assert.match(css, /\.studyGarden \.studyMap small\s*\{\s*color: inherit;/);
});
