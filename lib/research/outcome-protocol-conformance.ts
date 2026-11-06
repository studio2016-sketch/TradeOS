/** Known v3 resolver mismatch. A source-time certificate cannot attest to
 * resolver semantics. Remove this containment only after a reviewed resolver
 * repair, new prospective protocol activation, and independent conformance tests.
 * Never reclassify or rewrite the existing immutable outcome records. */
export const OUTCOME_PROTOCOL_CONFORMANCE = {
 status: "BLOCKED",
 code: "V3_RESOLVER_PROTOCOL_MISMATCH",
 scientificallyEligible: false,
 reason: "The v3 resolver uses trade/bar prices instead of the frozen midpoint, can use a start receipt after prediction, selects a source using future endpoint availability, and can include pre-entry excursions.",
 requirement: "Independently verify a repaired resolver against a newly activated prospective protocol before certification; existing v3 records remain descriptive research."
} as const;
