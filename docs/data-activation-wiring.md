# Disabled writer wiring and daily conflict correction

Follow-up to PR #101 at `8540e731e5ffc037e73a86bc1d662427661c0f58`. Both original-head CI jobs passed (safety run 43973604302 and storage run 43973604478). Those results do not replace final-head CI for this follow-up.

## Blocking integrity correction

Independent review found that daily finalization's `ON CONFLICT DO NOTHING` could silently accept a same-identity row with a different value/provenance. Actual PostgreSQL 17.6 reproduction retained `99999`, saved five of six candidates and permanently completed the claim. Earlier concurrency tests did not cover this collision and were insufficient to establish that invariant.

Finalization now materializes proposed rows and counts only identical preexisting rows (same full unique identity, value and JSONB provenance). The new database assertion requires:

`newly inserted rows + identical preexisting rows = proposed candidates`

If a value/provenance differs, a concurrent conflict is not visible in the statement snapshot, or the deadline has expired when insertion finishes, the assertion raises and rolls the entire statement back. No new evidence or completion is committed. The old row and consumed claim remain intact. No existing evidence is updated/deleted. Visible identical replays remain idempotent with accurate saved counts. An invisible concurrent duplicate is conservatively unverified and may fail closed; it is never assumed equivalent or automatically retried.

The prepared daily migration now includes `tradeos_assert_daily_completion`. Existing disposable installations of the older migration need explicit review of this added function. No production migration has been applied. The runtime preflight requires the new function and execution permission; old schema cannot accidentally proceed.

`docs/evidence/daily-conflict-regression-postgres.json` records the old-behavior reproduction, fixed value conflict, fixed provenance conflict and legitimate identical replay. Each scenario ran in its own disposable real PostgreSQL database. The fixed conflicts committed zero new rows and zero completions; the identical replay saved five of six candidates legitimately. Ten broader real PostgreSQL permission/concurrency checks also pass, in `docs/evidence/data-activation-postgres.json`.

## Slippage writer wiring, still disabled

The existing authenticated intraday route now delegates to an injectable runner. `DATA_ACTIVATION_POLICY.exactSlippageWrites` is **false** in a frozen source-controlled policy; environment variables, headers and request bodies cannot enable it. Default behavior remains the legacy persistence path.

After a separately reviewed activation, the exact path must pass read-only schema, type, append-only-trigger, table and sequence permission interlocks before retrieving inputs. It then routes all new slippage to exact storage and other factors to legacy storage. A preflight or write failure never falls back to rounded legacy slippage. Failed persistence receipts explicitly mark counts unknown and the zero saved field as a lower bound, rather than implying no partial writes occurred. Successful persistence followed by receipt failure retains known counts. An uncertain result does not authorize an automatic retry.

## Bounded manual invocation, still disabled

`POST /api/operations/daily-factor-collection` is the only prepared daily entry point. It is not in `vercel.json` cron schedules, has no GET handler, and requires the existing operator bearer authorization. `DATA_ACTIVATION_POLICY.dailyInvocation` is **null**, so even authenticated requests return 409 before parsing a body or touching the database/provider.

A separate activation must pin a source-controlled approval ID, one expected session, and an opening/expiry window no longer than 24 hours. The request must contain exactly matching `approvalId` and `session` fields (maximum 512 bytes). It cannot choose symbols, feed, concurrency, dates, row limits or retries. The full two-minute collector budget must fit inside the approved window when execution starts. Runtime clocks remain within that window; the durable claim's database deadline bounds persistence. Migration/append-only/permission preflight runs before any provider call or claim. Existing IEX feed and the fixed NVDA/AMD/PLTR scope remain unchanged. No new secret or environment configuration was created.

## Remaining readers and scientific boundaries

Added owner-only `GET /api/research-slippage?symbol=SPY&at=<timestamp>` for descriptive subject-scoped exact/legacy reads. It rejects invalid/future decision times and retains nanoseconds. Registry verification now exposes exact slippage separately, with legacy verification counts explicitly scoped. The #101 coverage, status, combined decision reader and descriptive diagnostics remain intact.

Factor-lab and prediction/outcome association consumers remain legacy-only, intentionally untouched to avoid duplicating outcome-protocol work. Certification/phase counters do not gain permission from exact evidence. This boundary is explicit rather than claiming every scientific reader consumes the new lane.

## Verification and activation requirements

573 local tests pass, including the actual authenticated-but-disabled POST route, no-work unauthorized paths, policy scope/deadline rejection, schema/trigger interlocks, no legacy fallback after exact failure, and value/provenance collision rollback. Actual PostgreSQL fixtures/roles were removed and the loopback server stopped. TypeScript and final build results are reported in the PR. These checks do not certify deployed Neon HTTP behavior, live feed availability or scientific validity.

Before any activation: review and apply the corrected additive migrations under separate authorization; verify deployed role grants and Neon transport; approve the frozen exact-writer switch and/or a specific manual daily window in a reviewed release; preserve outcome-consumer separation; review/extend the 2026 calendar before 2027. Inspect real receipts only after an authorized invocation. Never erase a claim to retry an uncertain attempt.

All deployment-disable entries remain in place. No production collector, migration, secret change, historical edit, schedule change, merge or deployment occurred.
