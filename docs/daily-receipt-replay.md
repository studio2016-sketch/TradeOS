# Read-only daily receipt replay, version 1

The first approved daily pilot saved 72 records for the November 17, 2026 session. Reading its JSONB completion changed the property order of each input bar. Hashing that readback directly did not reproduce the stored hash, even though every field value was unchanged. Restoring the original Alpaca adapter's six-field serialization reproduced all three hashes and all 72 numerical results.

## Contract and compatibility

replayDailyReceipt is a pure verifier. It cannot collect, persist, activate, promote or place orders. Neither the production collector/hash algorithm nor existing records are changed.

Verification version: tradeos.daily-receipt-replay.v1.
Supported input serialization: tradeos.alpaca-pricebar-json.v0.

Existing unversioned receipts are interpreted under the original fixed Alpaca:iex adapter. An optional histories[symbol].inputSerializationVersion may explicitly name that same version. Any other value fails closed. This optional verifier contract does not add a version field to historical or future production records.

The original field order is timestamp, open, high, low, close, volume. Only object-key order is reconstructed. All six fields must exist, no additional bar fields are accepted, array order must remain chronological, and timestamp spelling/numeric values are unchanged. Hashes, values, metadata, scope, receipt clocks, availability and research-only flags are checked. Future producer/hash/calculation changes require an explicitly reviewed replay version and preservation of this legacy contract; do not silently reinterpret old records.

The verifier reports verified identities separately from newly saved rows, since an identical preexisting row can legitimately reduce the insert count. A pass establishes internal reproducibility of the supplied snapshot, not that the snapshot came from a trusted database, that the provider is independently correct, or that a strategy is predictive.

## Local use

Supply a trusted JSON snapshot with claim, completion and evidence keys from the daily claim/completion and matching evidence tables:

    node --import tsx scripts/verify-daily-receipt.ts < receipt.json

The CLI accepts JSON on stdin only. It takes no credentials, opens no database/network connection, performs no writes and emits no raw bars. Invalid input produces a sanitized failure and nonzero exit status. Input streaming is bounded to 2 MB before JSON parsing.

## Validation

- Embedded PostgreSQL JSONB roundtrip reproduces the original key-order mismatch, then verifies all 72 values and hashes without modifying input.
- A frozen synthetic legacy digest and 24-value golden fixture detect silent changes.
- Tampered values/hashes/timestamps, duplicate/missing/extra identities, contradictory history provenance, unsupported versions and authority flags fail closed.
- The actual immutable November 17 production receipt was freshly retrieved read-only and passed: 72 verified identities, 72 newly saved, 200 input bars per symbol, availability 2026-11-18T00:54:57.382Z. Raw provider history is not committed as a test fixture.
- No migration, collection authorization, production data changes, trades or certification changes are included.
