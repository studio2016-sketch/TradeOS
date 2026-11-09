# Provider news request sharing

Previously each provider kept one process-wide pending promise. Concurrent Alpaca requests for different symbols or limits could return the first caller's articles. Massive fetches global articles, but its cache fallback depends on the caller's symbols, so sharing its pending work across different symbols was also incorrect.

Pending requests now use provider-local maps keyed by the normalized, deduplicated, sorted symbol set and effective provider limit. The existing twenty-symbol cap remains. Alpaca limits are capped at 50 and Massive at 20; equivalent capped limits share work. Zero, negative, fractional, nonfinite and unsafe limits reject before SQL or transport. Each consumer receives separate article objects and symbol arrays. Completion and rejection remove only the matching pending request.

Every distinct request still goes through the existing atomic database reservation: 30 seconds for Alpaca news and 60 seconds for Massive news. Denied reservations use the requesting caller's symbol-filtered cache and effective limit. No additional external call is authorized by the in-process map. Existing 429 cooldown behavior remains. Massive's successful network response remains global; this change does not add ticker filtering to that API request.

Twelve new regression groups exercise the actual provider adapters with mocked HTTP and SQL: canonical equivalence, capped limits, result mutation isolation, distinct symbols and limits, overlapping completion, cache isolation under budget denial, retry after rejection, and invalid limits before database access. These tests do not establish account-wide provider rate compliance or successful live collection.

Validation: 497 repository tests and TypeScript passed. See the integration report for build and temporary pending-resolver compatibility results. No production data, protocol, certification or trading mode is changed.
