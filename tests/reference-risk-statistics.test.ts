import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReferenceRiskStatistics as calculate } from '../lib/research/reference-risk-statistics.ts';
import type { ReferenceClose } from '../lib/research/reference-risk-statistics.ts';

// Fixtures are constructed from specified returns, not any production implementation.
function closes(returns: number[], hour = '16'): ReferenceClose[] {
  const values = [100];
  for (const r of returns) values.push(values.at(-1)! * (1 + r));
  return values.map((c, i) => ({
    c, t: `${new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)}T${hour}:00:00Z`,
  }));
}
function near(actual: number | null, expected: number, tolerance = 1e-11) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) <= tolerance, `${actual} != ${expected}`);
}
const returns20 = Array.from({ length: 20 }, (_, i) => (i - 9.5) / 1000);

for (const sessions of [20, 60] as const) {
  test(`${sessions} sessions: affine own returns give beta 2, Pearson 1`, () => {
    const market = Array.from({ length: sessions }, (_, i) => (i - sessions / 2) / 1000);
    const a = closes(market.map(r => 0.001 + 2 * r), '17');
    const b = closes(market);
    const result = calculate(a, b, sessions);
    near(result.beta, 2);
    near(result.correlation, 1);
    assert.equal(result.sampleCount, sessions);
    assert.equal(result.observedAt, a.at(-1)!.t.replace('Z', '.000Z'));
  });
}

test('reverse affine relationship gives beta -3 and correlation -1', () => {
  const result = calculate(closes(returns20.map(r => 0.002 - 3 * r)), closes(returns20), 20);
  near(result.beta, -3);
  near(result.correlation, -1);
});

test('orthogonal repeating return patterns give zero beta and correlation', () => {
  // Every four samples, both sums and their dot product vanish.
  const x = Array.from({ length: 20 }, (_, i) => [0.01, -0.01, 0.01, -0.01][i % 4]);
  const y = Array.from({ length: 20 }, (_, i) => [0.02, 0.02, -0.02, -0.02][i % 4]);
  const result = calculate(closes(x), closes(y), 20);
  near(result.beta, 0); near(result.correlation, 0);
});

test('constant own prices yield beta zero and undefined correlation', () => {
  const result = calculate(closes(Array(20).fill(0)), closes(returns20), 20);
  near(result.beta, 0); assert.equal(result.correlation, null);
});
test('constant benchmark and both constant prices have undefined denominators', () => {
  for (const own of [closes(returns20), closes(Array(20).fill(0))]) {
    const result = calculate(own, closes(Array(20).fill(0)), 20);
    assert.equal(result.beta, null); assert.equal(result.correlation, null);
  }
});

test('pairing uses UTC dates and observedAt uses latest source timestamp', () => {
  const a = closes(returns20), b = closes(returns20);
  a[20].t = '2026-01-22T01:00:00+08:00'; // Jan 21, 17:00 UTC
  const result = calculate(a, b, 20);
  assert.equal(result.observedAt, '2026-01-21T17:00:00.000Z');
});

test('incomplete, oversized and mismatched windows are rejected', () => {
  const a = closes(returns20);
  for (const b of [a.slice(1), [...a, a[20]], []]) assert.throws(() => calculate(a, b, 20));
  assert.throws(() => calculate(a.slice(1), a.slice(1), 20));
  assert.throws(() => calculate(a, a, 30 as 20));
});

test('invalid timestamps and impossible calendar/clock values are rejected', () => {
  for (const t of ['garbage', '', '2026-02-30', '2026-13-01', '2026-00-01',
    '2026-01-00', '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z',
    '2026-01-01T00:00:60Z', '2026-01-01T00:00:00+25:00', '2026-01-01T00:00:00']) {
    const a = closes(returns20); a[0].t = t;
    assert.throws(() => calculate(a, closes(returns20), 20), t);
  }
});

test('unequal UTC dates, duplicates, and descending dates are rejected', () => {
  const b = closes(returns20);
  const unequal = closes(returns20); unequal[20].t = '2026-01-22';
  assert.throws(() => calculate(unequal, b, 20));
  const duplicate = closes(returns20); duplicate[10].t = duplicate[9].t;
  assert.throws(() => calculate(duplicate, duplicate, 20));
  assert.throws(() => calculate([...b].reverse(), [...b].reverse(), 20));
});

test('invalid closes and nonfinite return arithmetic are rejected', () => {
  for (const c of [NaN, Infinity, -Infinity, 0, -1]) {
    const a = closes(returns20); a[4].c = c;
    assert.throws(() => calculate(a, closes(returns20), 20));
  }
  const a = closes(returns20); a[0].c = Number.MIN_VALUE; a[1].c = Number.MAX_VALUE;
  assert.throws(() => calculate(a, closes(returns20), 20), /Nonfinite/);
  const b = closes(returns20); b[1].c = 1e200;
  assert.throws(() => calculate(b, b, 20), /Nonfinite/);
});

test('does not modify either input', () => {
  const a = closes(returns20), b = closes(returns20);
  a.forEach(Object.freeze); b.forEach(Object.freeze); Object.freeze(a); Object.freeze(b);
  near(calculate(a, b, 20).beta, 1);
});
