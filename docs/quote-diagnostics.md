# Descriptive quote diagnostics

The Live Board separates the price observation clock from the bid/ask quote clock. Missing or future timestamps display unavailable, never inherit a trade timestamp. Valid positive uncrossed sides show spread in basis points relative to their midpoint; locked quotes show zero. No spread threshold is invented and no execution-quality or entitlement gate changes.

Coverage and source remain provider-reported. Response generation is not source receipt, so receipt lag is explicitly unavailable here. Single-venue IEX quotes are not consolidated NBBO and even fresh quotes are not guaranteed execution prices. Provider collection, persistence, immutable evidence and scientific restrictions are unchanged.

Focused arithmetic tests cover separate clocks, stale/missing/future quote timestamps, malformed/crossed/locked sides and missing source data. Full build and browser QA remain required before release.
