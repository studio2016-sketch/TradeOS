# Free Official Data Sources

TradeOS includes a no-cost official-data layer for research and context.

## Connected without credentials

These adapters require no private credential and are active automatically:

- CFTC Traders in Financial Futures — official weekly dealer, asset-manager and leveraged-money positioning.
- FINRA Reg SHO Daily — official daily short-sale volume reported to FINRA trade-reporting facilities.
- FINRA Consolidated Short Interest — official consolidated short-interest context.
- U.S. Treasury Daily Par Yield Curve — official Treasury rates and curve confirmation.
- BLS Public Data API v1 — CPI, PPI, payrolls, unemployment, average hourly earnings and JOLTS job openings.
- Cboe Daily Options Market Statistics — aggregate put/call ratios and options-market context.
- SEC EDGAR — filings and issuer facts.
- FRED public CSV series — current macro/regime context.

## Free registration-key adapters

These adapters are already implemented and auto-activate when the matching Vercel environment variable is added.

### FRED / ALFRED vintage data
Environment variable:

`FRED_API_KEY`

Purpose:
- initial-release macro observations
- revision-aware backtesting
- reduced look-ahead bias

### BEA
Environment variable:

`BEA_API_KEY`

Purpose:
- GDP
- personal income
- national accounts
- industry-cycle data

### EIA
Environment variable:

`EIA_API_KEY`

Purpose:
- petroleum inventories
- energy fundamentals
- energy/inflation/geopolitical transmission

## Endpoint

Read-only source snapshot:

`/api/free-sources?symbols=NVDA,AMD,PLTR,SPY,QQQ,IWM`

The response includes each source's:

- source ID
- connection status
- authority
- current data
- note
- error when degraded

## Persistence

The 15-minute Research Radar stores these observations as:

`official_source_snapshot`

Model version:

`free-official-v1`

This allows future learning to test whether CFTC positioning, FINRA short activity, Treasury-curve changes, BLS releases, Cboe options sentiment and other official observations added incremental predictive value.

## Safety

Official-source data is context/research evidence.

It is not execution eligible.

It cannot:

- place orders
- increase position size
- bypass the 120-gear decision engine
- bypass supervisory governors
- convert missing evidence into favorable evidence
