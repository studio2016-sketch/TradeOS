import test from "node:test";
import assert from "node:assert/strict";
import {GET} from "../app/api/historical-bars/route.ts";

const bar = (day: string, close = 100) => ({
  t: day + "T04:00:00Z", o: 100, h: 105, l: 95, c: close, v: 1000
});

test("daily history selects the newest provider page and preserves safeguards", async (t) => {
  const previous = {
    key: process.env.ALPACA_API_KEY,
    secret: process.env.ALPACA_API_SECRET,
    feed: process.env.ALPACA_FEED,
    fetch: globalThis.fetch
  };
  process.env.ALPACA_API_KEY = "test";
  process.env.ALPACA_API_SECRET = "test";
  process.env.ALPACA_FEED = "iex";
  try {
    await t.test("newest-first provider window is rendered chronologically", async () => {
      let calls = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls++;
        const url = new URL(String(input));
        assert.equal(url.pathname, "/v2/stocks/SPY/bars");
        assert.equal(url.searchParams.get("sort"), "desc");
        assert.equal(url.searchParams.get("limit"), "80");
        assert.equal(url.searchParams.get("timeframe"), "1Day");
        assert.equal(url.searchParams.get("adjustment"), "all");
        assert.equal(url.searchParams.get("feed"), "iex");
        assert.equal(init?.cache, "no-store");
        assert.ok(Date.parse(url.searchParams.get("end")!) > Date.parse(url.searchParams.get("start")!));
        return Response.json({
          bars: [bar("2026-11-03", 102), bar("2026-11-02", 101), bar("2026-10-30")],
          next_page_token: "older-history"
        });
      }) as typeof fetch;
      const response = await GET(new Request("https://tradeos.test/api/historical-bars?symbol=SPY"));
      const data = await response.json();
      assert.equal(calls, 1);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(data.status, "historical");
      assert.equal(data.hasMore, true);
      assert.deepEqual(data.bars.map((b: {time: string}) => b.time.slice(0, 10)),
        ["2026-10-30", "2026-11-02", "2026-11-03"]);
      assert.equal(data.source, "Alpaca:iex");
      assert.match(data.warning, /not live prices/);
    });

    await t.test("invalid provider OHLCV bars are still excluded", async () => {
      globalThis.fetch = (async () => Response.json({bars: [
        bar("2026-11-03"),
        {...bar("2026-11-02"), h: 90},
        {...bar("2026-11-01"), v: -1},
        {...bar("2026-10-31"), t: "invalid"},
        {...bar("2026-10-30"), c: 0}
      ]})) as typeof fetch;
      const data = await (await GET(new Request("https://tradeos.test/api/historical-bars?symbol=AAPL"))).json();
      assert.equal(data.bars.length, 1);
      assert.equal(data.bars[0].time, "2026-11-03T04:00:00Z");
      assert.equal(data.hasMore, false);
    });

    await t.test("provider failure returns unavailable, never fabricated bars", async () => {
      globalThis.fetch = (async () => new Response("", {status: 403})) as typeof fetch;
      const data = await (await GET(new Request("https://tradeos.test/api/historical-bars"))).json();
      assert.equal(data.status, "unavailable");
      assert.deepEqual(data.bars, []);
    });

    await t.test("invalid symbols and missing credentials do not call the provider", async () => {
      globalThis.fetch = (async () => { throw new Error("Provider must not be called"); }) as typeof fetch;
      const invalid = await GET(new Request("https://tradeos.test/api/historical-bars?symbol=BAD/INPUT"));
      assert.equal(invalid.status, 400);
      delete process.env.ALPACA_API_KEY;
      const data = await (await GET(new Request("https://tradeos.test/api/historical-bars"))).json();
      assert.equal(data.status, "unconfigured");
      assert.deepEqual(data.bars, []);
    });
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [
      ["ALPACA_API_KEY", previous.key], ["ALPACA_API_SECRET", previous.secret],
      ["ALPACA_FEED", previous.feed]
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
  }
});

