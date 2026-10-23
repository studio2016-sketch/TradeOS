const portfolioImplemented=new Set(["portfolio_exposure","single_name_weight","expected_shortfall","max_drawdown","var_95","position_volatility"]);
const portfolioPolicy=new Set(["sector_concentration","risk_budget_remaining"]);
const options=new Set(["implied_vol_atm","iv_rank","iv_skew"]);
const analyst=new Set(["pe_forward","estimate_revision"]);
const relationshipGraph=new Set(["supplier_event","competitor_event","geographic_exposure"]);
const eventDriven=new Set(["earnings_date","eps_surprise","revenue_surprise","guidance_change","buyback_announcement","customer_event","regulatory_change","tariff_exposure"]);
export type Phase3Blocker={
 key:string;category:string;requiresUserAction:boolean;detail:string;
};
export function phase3BlockerFor(key:string):Phase3Blocker|null{
 if(portfolioImplemented.has(key))return {key,category:"authorized_portfolio_evidence_pending",requiresUserAction:false,detail:"The read-only portfolio collector is installed; activation requires a non-empty authorized account and synchronized completed history. Single-security proxies remain forbidden."};
 if(portfolioPolicy.has(key))return {key,category:"portfolio_policy_or_classification_required",requiresUserAction:true,detail:key==="sector_concentration"?"Requires a complete, independently sourced sector classification for every current holding.":"Requires an explicit owner-approved daily risk-budget policy and reconciled realized P&L."};
 if(options.has(key))return {key,category:"option_surface_or_history_required",requiresUserAction:false,detail:key==="iv_rank"?"Requires enough fresh persisted ATM-IV history before rank can be calculated.":"Requires a fresh eligible option surface during an open session and sufficient quote coverage."};
 if(key==="pmi_manufacturing")return {key,category:"source_permission_required",requiresUserAction:true,detail:"Current FRED NAPM retrieval is unavailable; direct ISM PMI redistribution/use requires an appropriately authorized source or license."};
 if(analyst.has(key))return {key,category:"licensed_analyst_consensus_required",requiresUserAction:true,detail:"Requires point-in-time analyst consensus/estimate data; price-target headlines are not substituted for earnings estimates."};
 if(key==="earnings_call_sentiment")return {key,category:"transcript_source_required",requiresUserAction:true,detail:"Requires timestamped earnings-call transcript/audio-derived text with publication provenance."};
 if(relationshipGraph.has(key))return {key,category:"relationship_graph_required",requiresUserAction:false,detail:"Requires independently sourced supplier/customer/competitor/geographic relationship evidence before activation."};
 if(eventDriven.has(key))return {key,category:"explicit_event_required",requiresUserAction:false,detail:"Collector is event-driven; absence of a qualifying observed event remains unavailable rather than being stored as zero."};
 return null;
}
export function phase3KnownExternalBlockers(){
 return [...portfolioImplemented,...portfolioPolicy,...options,"pmi_manufacturing",...analyst,"earnings_call_sentiment",...relationshipGraph,...eventDriven].map(key=>phase3BlockerFor(key)!).filter(Boolean);
}
