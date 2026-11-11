# FRED history intake validation

The keyless FRED graph CSV adapter supplies current-vintage macro observations to the regime context and official macro evidence calculations. The prior adapter trusted the header and row order, admitted impossible/future dates and duplicate observation dates, and used JavaScript numeric coercion. Synthetic HTTP responses reproduced wrong-series attribution, February 30, a 2099 date, conflicting dates, and `0x20` becoming 32. These reproductions do not establish that malformed data occurred in production.

The intake boundary now:

- Requires a two-column `observation_date,<requested series>` or legacy `DATE,<requested series>` header. UTF-8 BOM and CRLF are accepted.
- Requires strict real calendar dates no later than the UTC request date. Identical or conflicting duplicate dates reject the whole response, including duplicates with missing values.
- Retains explicit empty or `.` values as missing, never zero. Other values must be decimal/scientific notation, finite, and not nonzero values underflowing to zero.
- Rejects malformed rows without returning a partial older history that could appear to be the newest available observation.
- Sorts validated observations by date before latest, previous, and year-over-year derivation. A nonfinite computed regime percentage change remains unavailable.
- Preserves the existing no-cache request, ten-second timeout, source identity and `ok`/`empty`/`error` result contract. Invalid request arguments return structured errors without making a provider request.

Tests exercise the pure parser and mocked fetch boundary, current/previous and YoY selection, finite calculation output, and the macro evidence collector. Rejected histories produce no measured macro or DXY evidence. They do not connect to a provider or production database.

This change does not establish source accuracy, data freshness, historical release availability, provider completeness or predictive value. A calendar observation date is not a release timestamp. Existing current-vintage, no-backtest and no-trading restrictions remain unchanged. No stored evidence is modified, no migration is added, and this patch alone authorizes no publication, deployment, activation or purchase.
