# Durable owner-only pilot receipt

The existing `/operations/daily-pilot` server page now reads the latest durable attempt after its existing current-owner authorization succeeds. It renders a small receipt that survives a full-page refresh. No new API endpoint or request-controlled session selector is introduced.

A single read-only SQL transaction loads the latest claim/completion plus matching evidence. The query limits evidence to 73 rows (one over the expected72 detects excess), limits completion details to1.5MB and each evidence metadata object to8KB, and runs within an8-second abortable budget. There are no provider calls, inserts, updates, migrations, retries, activation changes or order actions.

The existing `tradeos.daily-receipt-replay.v1` verifier is authoritative for receipt verification. Only a successful replay of the claim, original input hashes and72 evidence identities produces “Saved collection verified.” Raw inputs, prices, hashes, metadata and error details are never passed into the client receipt. The newly-saved count stays separate from verified identities, because identical existing evidence can make these counts differ.

Missing, claimed-without-completion, failed verification and read-unavailable states are visibly distinct and never authorize retries. A newer incomplete claim is not hidden behind an older success. Scientific certification and order execution remain blocked. The receipt is explicitly historical, not a fresh market-data assessment. The existing collection controls and their explicit-approval/one-attempt behavior are unchanged.

The refresh link only reloads this GET page. A new POST result does not silently replace the durable receipt; refresh rereads the saved records. Authorization is repeated on every server request. The route remains force-dynamic and does not introduce shared caching.

Tests cover actual PostgreSQL JSONB round-trip and snapshot SQL, reload stability, incomplete/latest attempts, duplicate evidence, tampered data, sanitized failures, rendered authority boundaries and the actual page's authorization-before-read ordering. Actual signed-in browser/mobile QA is separate and must not be inferred from these tests.
