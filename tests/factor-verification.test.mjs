import test from 'node:test';
import assert from 'node:assert/strict';

// Pure, deterministic gates. This module never grants provider entitlement
// or independent source-time certification from database metadata alone.
export function evidencePrecheck({ rows, freshnessSeconds, nowMs }) {
  if (!rows.length) return 'missing_evidence';
  if (rows.some(r => r.value == null || !Number.isFinite(Number(r.value)) ||
      !r.source_name || !r.observed_at || !r.available_at)) return 'incomplete_evidence';
  if (rows.some(r => {
    const observed = Date.parse(r.observed_at);
    const available = Date.parse(r.available_at);
    return !Number.isFinite(observed) || !Number.isFinite(available) ||
      available < observed || observed > nowMs + 300000;
  })) return 'timestamp_anomaly';
  if (freshnessSeconds != null &&
      Math.max(...rows.map(r => Date.parse(r.observed_at))) <
        nowMs - freshnessSeconds * 1000) return 'stale_evidence';
  return 'evidence_precheck_passed';
}

export function implementationGate({ evidenceStatus, calculationFixturePassed,
  pointInTimeInputsVerified, providerPermissionVerified,
  sourceTimeIndependentlyCertified }) {
  return evidenceStatus === 'evidence_precheck_passed' &&
    calculationFixturePassed === true &&
    pointInTimeInputsVerified === true &&
    providerPermissionVerified === true &&
    sourceTimeIndependentlyCertified === true
    ? 'verified' : 'unverified';
}

const nowMs = Date.parse('2026-10-26T15:00:00Z');
const row = { value: 1.25, source_name: 'test-source',
  observed_at: '2026-10-26T14:59:00Z',
  available_at: '2026-10-26T14:59:01Z' };

test('no evidence remains missing', () =>
  assert.equal(evidencePrecheck({rows: [], nowMs}), 'missing_evidence'));
test('complete fresh evidence passes precheck', () =>
  assert.equal(evidencePrecheck({rows: [row], freshnessSeconds: 900, nowMs}), 'evidence_precheck_passed'));
test('stale evidence is not current', () =>
  assert.equal(evidencePrecheck({rows: [row], freshnessSeconds: 30, nowMs}), 'stale_evidence'));
test('available-before-observed fails', () =>
  assert.equal(evidencePrecheck({rows: [{...row,available_at:'2026-10-26T14:58:00Z'}], nowMs}), 'timestamp_anomaly'));
test('missing value fails', () =>
  assert.equal(evidencePrecheck({rows: [{...row,value:null}], nowMs}), 'incomplete_evidence'));
test('one missing certification gate prevents verification', () =>
  assert.equal(implementationGate({evidenceStatus:'evidence_precheck_passed',
    calculationFixturePassed:true,pointInTimeInputsVerified:true,
    providerPermissionVerified:true,sourceTimeIndependentlyCertified:false}), 'unverified'));
test('all explicitly true gates required', () =>
  assert.equal(implementationGate({evidenceStatus:'evidence_precheck_passed',
    calculationFixturePassed:true,pointInTimeInputsVerified:true,
    providerPermissionVerified:true,sourceTimeIndependentlyCertified:true}), 'verified'));
