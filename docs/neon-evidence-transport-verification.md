# Neon evidence transport verification — November 8, 2026

## Production inspection (read-only)

The TradeOS Neon project `rapid-darkness-67730194`, production branch `br-wispy-butterfly-b5cxm05y`, database `neondb`, was inspected using catalog SELECTs and table-schema metadata. No production connection credential was exported and no production evidence rows were written.

Observed settings: PostgreSQL 18.6, timezone GMT, DateStyle ISO/MDY. Both evidence timestamp columns have fractional precision 6. The deployed unique key is `(factor_key, domain, subject, source_name, observed_at, available_at)`. The `tradeos_factor_evidence_protect` trigger is enabled for UPDATE and DELETE and calls the expected append-only rejection function.

The deployed evidence table has no CHECK enforcing observation time <= availability time. The initial embedded test used an explicitly representative order constraint; the updated test now reproduces the actual missing backstop before applying the proposed constraint only inside its local engine. Application gating remains essential until an approved database change is applied.

## Executed staging HTTP verification

The existing branch `tradeos-replay-receipts-staging-20261025` (`br-twilight-band-b5h0alm8`) was used. No new branch, project or compute was provisioned and no compute settings were changed. The exact installed `@neondatabase/serverless@1.2.0` HTTP driver executed the current collector/persistence implementations through isolated adapters.

All writes targeted temporary tables created inside the same HTTP transaction as their INSERT/readback and marked ON COMMIT DROP. `LIKE ... INCLUDING ALL` copied staging table definitions, not rows. The copied evidence ID sequence default was replaced with a constant, so even staging's persistent sequence was untouched. Each unqualified application query used an explicit transaction-local `pg_temp,public` search path, and the readback verified a `pg_temp_*` namespace. The persistent article/evidence tables were neither populated nor rewritten. The proposed order check was exercised on a temporary table only. No production migration was applied.

The audit passed these checks:

- Actual `persistEvidenceWithSql` INSERT and protected metadata serialization, including duplicate conflict no-op.
- Supported microsecond timestamp text survives HTTP binding, PostgreSQL insertion and text readback exactly.
- Native timestamp reads return JavaScript Date objects, confirming why the collector must SELECT timestamp text.
- Nonzero submicrosecond timestamps and observation-after-availability candidates are rejected before SQL.
- PostgreSQL rounds a synthetic one-nanosecond-later receipt into the earlier microsecond tie; persistence rejects this precision before insertion.
- SQL decision cutoffs exclude a receipt one microsecond after the decision.
- The inherited append-only rejection function rejects UPDATE and DELETE on synthetic temporary rows.
- The proposed order check rejects a future observation on a temporary table.
- The actual news-cache SELECT, parser, candidate builder and evidence INSERT retain publication microseconds.

This is Neon HTTP transport verification on staging, not a successful production collection or independent scientific certification. HTTP batching used for temporary-table isolation is not the application's ordinary per-INSERT transaction lifecycle. Current production code, credentials/roles, privileges, session configuration and table definitions may differ from staging; the catalog inspection establishes only the listed production metadata at inspection time.

The updated local suite passed 446 tests, full TypeScript and the production build. A temporary compatibility run including pending PR #81 passed 466 tests and TypeScript; the v4 resolver remains excluded from this draft. Remote CI results must be checked on the final PR commit.

## Reusable audit and proposed database backstop

`scripts/check-neon-evidence-transport.ts` accepts one JSON line on stdin containing `connectionString`. It deliberately accepts only the identified staging hostname (direct or pooled) and the `neondb` database; it rejects production/unknown endpoints before network access. Do not put credentials in command arguments, logs, committed files or report artifacts. Output is a sanitized PASS/FAIL JSON summary. `tests/neon-transport-safety.test.ts` checks endpoint rejection and credential-safe output without network access.

`db/migrations/20261108_factor_evidence_vintage_order.sql` is prepared for owner review, not applied. Its NOT VALID order constraint enforces the rule on future writes while preserving existing immutable rows without a historical scan or relabeling. It intentionally does not validate or certify historical evidence. Applying ALTER TABLE still requires an operational schema lock and explicit approval; no automatic migration runner or production action was added.

Provider timestamp semantics, cache mutability, independent source/time certification, prospective protocol binding and paper-only restrictions remain unchanged. No merge, deployment, production collector invocation or trading authorization occurred.
