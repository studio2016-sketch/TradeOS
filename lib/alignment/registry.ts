export type AlignmentGroup =
  | "Market Regime" | "Instrument Quality" | "Multi-Timeframe Trend" | "Momentum"
  | "Volatility & Risk" | "Volume & Order Flow" | "Setup Quality" | "Timing & Execution"
  | "Catalyst & Information" | "Discipline & Capital Protection";

export interface AlignmentVariableDef{
  id:string;
  group:AlignmentGroup;
  label:string;
  weight:number;
  criticalBuy?:boolean;
  hardSell?:boolean;
}

const G:Record<AlignmentGroup,string[]> = {
  "Market Regime":[
    "SPY trend direction","QQQ trend direction","IWM trend direction","Sector relative strength","Breadth participation",
    "VIX condition","Yield environment","Dollar risk tone","Economic event risk","Market session condition"
  ],
  "Instrument Quality":[
    "Average daily volume","Relative liquidity","Bid-ask spread quality","Float structure","Volatility usability",
    "Chart cleanliness","Institutional participation","Options liquidity","Market correlation","Tradeability score"
  ],
  "Multi-Timeframe Trend":[
    "Daily trend alignment","4-hour trend alignment","1-hour trend alignment","15-minute trend alignment","5-minute trend alignment",
    "Moving-average stack","Moving-average slope","Higher-high / higher-low structure","Anchored VWAP alignment","Trend durability"
  ],
  "Momentum":[
    "RSI quality","MACD quality","Rate of change","Price acceleration","Volume acceleration",
    "Breakout force","Follow-through strength","Squeeze release","Momentum persistence","Relative strength vs peers"
  ],
  "Volatility & Risk":[
    "ATR suitability","Expected-move context","Gap risk","Intraday range condition","Stop-distance practicality",
    "Reward-to-risk ratio","Position-size compatibility","Realized volatility regime","Volatility expansion / compression","Loss-containment potential"
  ],
  "Volume & Order Flow":[
    "Relative volume","Breakout-level volume","VWAP behavior","Accumulation behavior","Bid-ask imbalance",
    "Tape aggression","Block participation","Absorption / exhaustion","Opening-auction quality","Volume-confirmation persistence"
  ],
  "Setup Quality":[
    "Breakout quality","Pullback quality","Support / resistance clarity","Base quality","Trend-continuation quality",
    "Reversal-pattern quality","Confluence count","Failed-move trap risk","Clean invalidation level","Setup repeatability"
  ],
  "Timing & Execution":[
    "Time-of-day edge","Opening-range behavior","Confirmation-candle close","Reclaim / hold behavior","Retest success",
    "Trigger proximity","Chase-avoidance condition","Execution slippage risk","Market-internals confirmation","Entry precision"
  ],
  "Catalyst & Information":[
    "Earnings / guidance relevance","SEC filing significance","News quality","News freshness","Headline-to-price reaction",
    "Analyst revision pressure","Sector narrative strength","Sentiment condition","Event asymmetry","Catalyst interpretation confidence"
  ],
  "Discipline & Capital Protection":[
    "Daily-loss-limit status","Current open-risk status","Correlation exposure","Trade-count discipline","Tilt / emotional-risk check",
    "Checklist completion","Broker / platform readiness","Stop-order readiness","Profit-target readiness","Journal accountability"
  ]
};

const weights:Record<AlignmentGroup,number> = {
  "Market Regime":15,"Instrument Quality":8,"Multi-Timeframe Trend":12,"Momentum":10,
  "Volatility & Risk":12,"Volume & Order Flow":12,"Setup Quality":10,"Timing & Execution":10,
  "Catalyst & Information":6,"Discipline & Capital Protection":5
};

const criticalLabels = new Set([
  "SPY trend direction","QQQ trend direction","Relative liquidity","Bid-ask spread quality",
  "5-minute trend alignment","Anchored VWAP alignment","Reward-to-risk ratio","Loss-containment potential",
  "Relative volume","VWAP behavior","Clean invalidation level","Chase-avoidance condition",
  "Execution slippage risk","Daily-loss-limit status","Stop-order readiness"
]);

const hardSellLabels = new Set([
  "Loss-containment potential","Clean invalidation level","Daily-loss-limit status",
  "Current open-risk status","Stop-order readiness","VWAP behavior","Bid-ask spread quality"
]);

export const alignmentVariables:AlignmentVariableDef[] = Object.entries(G).flatMap(([group,labels])=>{
  const groupName=group as AlignmentGroup;
  const per=weights[groupName]/labels.length;
  return labels.map((label,i)=>({
    id:`${groupName.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${String(i+1).padStart(2,"0")}`,
    group:groupName,label,weight:per,
    criticalBuy:criticalLabels.has(label),
    hardSell:hardSellLabels.has(label)
  }));
});
