import {NextResponse} from "next/server";
import {configuredSourceHealth} from "../../../lib/market/providers";
export const dynamic="force-dynamic";
export async function GET(){
  const brokerReadEnabled=process.env.TRADEOS_ALLOW_ACCOUNT_READ==="true";
  const tradingEnvironment=process.env.ALPACA_TRADING_ENV||null;
  const alpacaConfigured=Boolean(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET);
  const massiveConfigured=Boolean(process.env.MASSIVE_API_KEY);
  const alpacaFeed=process.env.ALPACA_FEED||"iex";
  const optionFeed=process.env.ALPACA_OPTIONS_FEED||"indicative";
  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    sources:configuredSourceHealth(),
    connections:[
      {
        id:"sec",label:"SEC EDGAR",status:"connected",cost:"public",
        coverage:"Authoritative company filings / disclosure catalysts"
      },
      {
        id:"fred",label:"FRED / Federal Reserve",status:"connected",cost:"public",
        coverage:"VIX, rates, yield curve, broad dollar, high-yield credit spread, WTI"
      },
      {
        id:"alpaca",label:"Alpaca Market Data",status:alpacaConfigured?"connected":"needs_credentials",
        cost:alpacaConfigured?"account plan":"Free Basic available",
        equitiesFeed:alpacaFeed,
        optionsFeed:optionFeed,
        coverage:alpacaFeed==="sip"?"All-exchange real-time stocks + configured options":alpacaFeed==="iex"?"Real-time IEX stocks + indicative options/news":"Configured Alpaca feed"
      },
      {
        id:"massive",label:"Massive",status:massiveConfigured?"connected":"needs_credentials",
        cost:massiveConfigured?"account plan":"Free Basic available; real-time plan optional",
        coverage:massiveConfigured?"Configured market/reference feed":"EOD/reference on free tier; paid plans add delayed or real-time consolidated data"
      },
      {
        id:"portfolio",label:"Broker / portfolio state",status:brokerReadEnabled?"read_only_enabled":"approval_required",
        cost:"depends on broker",
        coverage:brokerReadEnabled?`Read-only account/positions/open-order state (${tradingEnvironment||"environment not set"})`:"Read-only adapter is installed but disabled until explicit authorization"
      }
    ],
    readiness:{
      publicSources:true,
      intradayEquities:alpacaConfigured||massiveConfigured,
      optionsSurface:alpacaConfigured,
      providerNews:alpacaConfigured||massiveConfigured,
      portfolioRisk:brokerReadEnabled
    }
  });
}
