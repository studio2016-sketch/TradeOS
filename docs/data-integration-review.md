# Data integration review on released main #99

Base: `df00e071e46d28dad2eaf72a0c158ec2528aae73`. Reconciles #98 (`1a3e317`) and #100 (`9969222`) without changing either source branch. The only cherry-pick conflicts were their Vercel deployment-disable maps; all entries were retained, including #99's. Main's `lib/market/shadow.ts` and its chronology regressions remain byte-identical. This is a fresh integration review by the implementing agent, not a separate third-party reviewer sign-off.

## Findings and repairs

The exact table/decision reader and immutable daily claim/finalization design passed local real-PostgreSQL tests. The remaining reader gap was material: legacy coverage readers could not see exact slippage, and simply casting a nanosecond decision cutoff to `timestamptz` could admit a later microsecond receipt.

Added `slippage-coverage-reader.ts` with optional-schema detection, integer-nanosecond window comparisons, strict readback, source-preserving timestamps and explicit cross-lane conflict rejection. Absence of the prepared public table is reported as `not_migrated`; a permissions or query error propagates, rather than becoming fake empty coverage. The combined subject-scoped reader compares legacy `extract(epoch)*1000000000` and exact integer nanoseconds against the same cutoff. It never converts a nanosecond cutoff to `timestamptz`.

Integrated consumers:

- Owner `/api/research-acceleration/coverage`: latest exact/legacy slippage selected by exact time, original timestamp precision retained, storage lane exposed. The 24-hour window is explicitly an availability window, not source freshness certification.
- Owner study status: separate seven-day exact slippage diagnostics; legacy macro count scope made explicit.
- Factor coverage audit: separate exact slippage history/count/latest time and a combined **descriptive** measured-key count. Existing legacy counts feeding readiness/phase gates are unchanged.
- Factor verification: exact slippage reported separately, explicitly outside certification. No verification/promotion/trading permission changes.
- A prepared combined subject-scoped decision reader is available for future reviewed consumers. Existing factor-lab and prediction/outcome association queries deliberately remain legacy-only; outcome-dependent integration is outside this task. No outcome-validation code was edited.

No production writer uses the prepared exact persistence boundary. No production caller invokes the daily runner. No schedules changed, migrations applied outside disposable fixtures, or historical rows modified.

## Real PostgreSQL evidence

A pinned `@embedded-postgres/linux-x64@17.6.0-beta.15` binary package and `pg@8.16.3` test client were installed in a separate local directory, without changing application dependencies. PostgreSQL 17.6 ran only on loopback port 55439 with Unix sockets disabled because this execution environment does not support them. The harness refuses remote connection settings and verifies the exact local data directory before creating any fixture database.

`scripts/verify-local-data-postgres.ts` applied the actual migration files to a newly created disposable database with a legacy sentinel. Nine checks passed, recorded in `docs/evidence/data-integration-postgres.json`:

1. Additive migrations preserve existing legacy data.
2. Concurrent independent client connections deduplicate an exact observation.
3. A concurrent conflicting immutable identity is rejected.
4. A SELECT-only role reads original nanoseconds and exact cutoffs.
5. The combined reader excludes a legacy microsecond beyond a nanosecond cutoff.
6. Restricted roles cannot mutate evidence; even the owner hits append-only DELETE/TRUNCATE triggers.
7. Concurrent daily claims produce one winner.
8. A deliberately failing finalization rolls back all new rows, leaves no completion and preserves its consumed claim.
9. Concurrent finalization produces exactly one completion and 72 daily rows.

Fixture roles/databases were removed in `finally`, and the local cluster was stopped. No Neon branch, production data, credentials or production collector was accessed. These results verify PostgreSQL behavior and explicit fixture grants, not Neon HTTP transport, deployed role permissions, production schema search paths, operational feed completeness or a trading edge.

The complete local suite passed 566 tests. Full TypeScript and webpack production build are checked on the final tree with nonsecret placeholder auth settings; exact results are reported in the draft PR. The combined reader's `.000000999` versus `.000001000` regression passes in both PGlite and real PostgreSQL.

## Remaining activation requirements

- Review this consolidated candidate instead of independently merging overlapping #98/#100. No merge/release is authorized here.
- Review the additive migrations against the actual production schema and backup/restore controls, apply them only under separate authorization, and verify their objects are in `public`. Do not retry an uncertain migration blindly or backfill historical records.
- Establish least-privilege runtime grants (schema usage, table SELECT/INSERT and sequence usage for writers; SELECT only for readers). Verify exact numeric/string transport and duplicate behavior through the deployed Neon client. Local pg-client tests do not establish those deployment-specific properties.
- Before enabling the exact writer, explicitly wire the intraday route to its prepared persistence boundary and confirm intended consumers use the exact reader. Outcome-dependent consumers remain legacy-only and require separate protocol review if exact evidence is to participate. Certification must stay blocked independently of storage success.
- Authorize an invocation plan for the bounded three-symbol daily runner; inspect real source-labelled IEX bars and receipts after activation. Claims are not automatically retried. No cadence or collector execution was enabled here.
- Extend/review the 2026 calendar before 2027. Keep distinct 200-session calculation provenance, availability versus source-date semantics, and all existing paper-only/scientific safeguards.

Production slippage rejection and stale daily coverage remain unchanged until a separately approved activation. The 14 previously absent catalog keys are not claimed resolved by these repairs.
