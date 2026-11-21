# Scheduled completed-session research collection

The previous daily collector had a prepared atomic writer and a bounded one-session pilot, but no ongoing schedule. The new cron calls the same complete-window calculation and durable claim/completion path at 22:15 UTC on weekdays.

Scope is fixed to NVDA, AMD and PLTR, 24 daily technical factors per symbol. Each attempt makes three bounded IEX daily-history requests, concurrency two, with the existing 12-second provider timeouts. All three symbols must supply a valid trailing 200-session history and all 72 factors before atomic finalization. Original provider dates, receipt times, input hashes, calculation provenance and immutable completion details are preserved.

Requests require the existing CRON_SECRET. No body, query parameters, caller-selected symbol, session, feed, arbitrary SQL, model promotion or orders are accepted. Schema, append-only triggers and connection permissions are checked read-only before the collector claims a session. Production already has the daily tables, append-only triggers and completion assertion; runtime checks remain authoritative for the actual application role.

Weekends and holidays skip without collection. An unfinalized session fails closed. Existing durable claims prevent another attempt for the same session/policy; failures are not automatically retried. A timeout can leave an unconfirmed receipt, and must not be represented as a successful collection.

This is an ongoing research collection path authorized by the November 20 completion request. The expired one-session manual endpoint stays disabled. The exact-slippage activation switch stays disabled and no existing evidence, privileges, schema or certification is changed.

The inherited pinned exchange calendar covers 2026 only. Calls outside its coverage fail closed. Extending that calendar requires a separately sourced exchange schedule and tests; the cron must not invent future market sessions.

Validation: 681 tests passed, including authorization-before-I/O, holiday/weekend skips, finalization/calendar bounds, bounded sanitized receipts, duplicate claims and failure/expired-clock behavior. TypeScript and the production build passed. A successful authenticated production collection is still required to establish provider/runtime readiness; deployment alone does not establish freshness or scientific validity.
