# Strict parsing of reported earnings dates and surprises

The news-event collector previously converted `Earnings on February 30, 2030` to March 2 through JavaScript calendar normalization. It also interpreted `EPS $1,43 beats $1.20 estimate` as actual EPS of 143, yielding an apparent surprise of 118.1667 (11,816.67%). A contradictory `EPS $1 beats $2 estimate` produced negative surprise despite the explicit “beats” label. These are reproducible parser defects, not evidence that these examples occurred in stored user observations.

The repair applies to future extraction of `earnings_date`, `eps_surprise` and `revenue_surprise`:

- Earnings dates must roundtrip to the requested year, month and day. Leap-day validity is checked. Missing-year rollover remains limited by the existing -1 to 180 day window, and explicit years are accepted with or without a comma.
- Distinct matched earnings dates are unavailable rather than choosing the first match, including multiple earnings clauses in one sentence. Matching starts at the first nearby date so an impossible earlier date cannot be swallowed by a later valid date. Repeated identical matched earnings clauses remain usable.
- Ordinal dates retain their explicit years, and malformed alphanumeric year tokens cannot be partially parsed. Explicit adjacent date alternatives or lists (for example, “March 5, 2030 or March 6, 2030”) are conservatively unavailable even when they share a single earnings cue. This does not claim comprehensive interpretation of natural-language schedules.
- Amounts must use plain decimal digits or valid groups of three comma-separated digits. No comma removal occurs until grouping is validated. Unit multipliers and surprise arithmetic must remain finite.
- Actual and estimate values must agree with their explicit beat/miss direction; a zero denominator is unavailable. Multiple different matched reports for one metric are ambiguous; repeated identical reports remain usable.
- New evidence metadata identifies `tradeos.reported-news-events.v2`. Existing immutable evidence is not rewritten, relabeled or certified by the new parser.

Focused regression tests cover impossible calendars, leap years, year rollover, multiple matched dates, numeric grouping, negative EPS, revenue scaling, label contradictions, zero denominators, overflow, conflicting reports, same-sentence dates, ordinal-year boundaries, and explicit adjacent date alternatives. Existing event-parser tests continue to verify ordinary EPS/revenue/date extraction and unrelated event classifications.

The parser remains a narrow template extractor, not a general financial language interpreter. Multiple quarters, revisions, currencies, context outside the matched templates and prose without explicit reported values may remain unavailable or require separate review. Recognition is not independent verification of a publisher's numbers, source-time availability or predictive value. No production collector was invoked and no production evidence was modified during this repair.

