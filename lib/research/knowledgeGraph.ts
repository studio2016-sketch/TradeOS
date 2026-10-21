import {secIssuerContext} from "../market/sec";
import {buildMarketContext} from "../market/context";
import {freeOfficialSnapshot} from "../market/freeOfficial";

export type GraphNodeType="company"|"industry"|"market"|"economic"|"positioning";
export interface GraphNode{id:string;type:GraphNodeType;label:string;metadata?:any}
export interface GraphEdge{
  id:string;from:string;to:string;relation:string;
  evidenceClass:"authoritative"|"empirical"|"derived";
  sources:string[];independentSourceCount:number;
  strength:number|null;direction:"positive"|"negative"|"mixed"|"unknown";
  predictiveAuthority:false;
  note:string;
}
export interface FinancialKnowledgeGraph{
  generatedAt:string;symbols:string[];nodes:GraphNode[];edges:GraphEdge[];
  stats:{nodes:number;edges:number;multiSourceEdges:number;authoritativeEdges:number;sourceFamilies:string[]};
  sourceHealth:{id:string;label:string;url:string|null;status:string;authoritative:boolean;observedAt:string;note:string;error:string|null}[];
  policy:{graphImpliesPrediction:false;minimumIndependentSourcesForCertification:number;sourceCountMeansIndependentOriginFamilies:true};
}

const sectorNames:Record<string,string>={
  SMH:"Semiconductors",XLK:"Technology",XLC:"Communication Services",XLY:"Consumer Discretionary",
  XLF:"Financials",XLE:"Energy",XLV:"Health Care",XLI:"Industrials",XLP:"Consumer Staples",
  XLU:"Utilities",XLB:"Materials",XLRE:"Real Estate"
};
const officialSourceUrls:Record<string,string>={
  cftc:"https://publicreporting.cftc.gov/",
  finra:"https://developer.finra.org/docs",
  treasury:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  "bls-data":"https://www.bls.gov/developers/",
  cboe:"https://www.cboe.com/us/options/market_statistics/daily/",
  alfred:"https://fred.stlouisfed.org/docs/api/fred/",
  bea:"https://apps.bea.gov/api/",
  eia:"https://www.eia.gov/opendata/"
};
function clamp(n:number){return Math.max(0,Math.min(100,n))}
function pushNode(map:Map<string,GraphNode>,node:GraphNode){if(!map.has(node.id))map.set(node.id,node)}
function edge(id:string,from:string,to:string,relation:string,evidenceClass:GraphEdge["evidenceClass"],sources:string[],strength:number|null,direction:GraphEdge["direction"],note:string):GraphEdge{
  return{id,from,to,relation,evidenceClass,sources:[...new Set(sources)],independentSourceCount:new Set(sources).size,strength,predictiveAuthority:false,direction,note};
}

export async function buildFinancialKnowledgeGraph(symbols:string[]):Promise<FinancialKnowledgeGraph>{
  const clean=[...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(Boolean))].slice(0,30);
  const nodes=new Map<string,GraphNode>(); const edges:GraphEdge[]=[]; const issuerBy=new Map<string,any>(); const ctxBy=new Map<string,any>();
  ["SPY","QQQ","IWM"].forEach(s=>pushNode(nodes,{id:"market:"+s,type:"market",label:s}));
  const official=await freeOfficialSnapshot(clean).catch(()=>null);
  const officialBy=new Map((official?.sources??[]).map((s:any)=>[s.id,s]));

  for(const symbol of clean){
    const [issuer,ctx]=await Promise.all([secIssuerContext(symbol).catch(()=>null),buildMarketContext(symbol).catch(()=>null)]); issuerBy.set(symbol,issuer); ctxBy.set(symbol,ctx);
    const companyId="company:"+symbol;
    pushNode(nodes,{id:companyId,type:"company",label:issuer?.company||symbol,metadata:{symbol,cik:issuer?.cik??null}});
    if(issuer){
      edges.push(edge("issuer:"+symbol,companyId,"source:SEC","identified_by","authoritative",["SEC EDGAR"],100,"unknown","SEC issuer identity and public-company facts."));
    }
    const proxy=ctx?.sector?.proxy;
    if(proxy){
      const industryId="industry:"+proxy;
      pushNode(nodes,{id:industryId,type:"industry",label:sectorNames[proxy]||proxy,metadata:{proxy}});
      const rs=ctx?.sector?.relativeStrengthScore??null;
      const industrySources=issuer?.sic?["SEC EDGAR SIC","Alpaca SIP historical"]:["Alpaca SIP historical","TradeOS sector taxonomy"];
      edges.push(edge("industry:"+symbol+":"+proxy,companyId,industryId,"trades_with_industry_proxy","empirical",industrySources,rs,rs==null?"unknown":rs>=55?"positive":rs<=45?"negative":"mixed","Industry relationship combines corporate classification where available with observed relative behavior; it is not a causal or predictive claim."));
    }
    const corr=ctx?.correlation?.spy20;
    if(corr!=null){
      edges.push(edge("market-corr:"+symbol,companyId,"market:SPY","historical_correlation","empirical",["Alpaca SIP historical"],clamp(Math.abs(corr)*100),corr>=.15?"positive":corr<=-.15?"negative":"mixed","Trailing correlation describes co-movement only."));
    }
  }

  for(let i=0;i<clean.length;i++){
    for(let j=i+1;j<clean.length;j++){
      const a=clean[i],b=clean[j],ia=issuerBy.get(a),ib=issuerBy.get(b),ca=ctxBy.get(a),cb=ctxBy.get(b);
      const sameSic=Boolean(ia?.sic&&ib?.sic&&ia.sic===ib.sic);
      const sameProxy=Boolean(ca?.sector?.proxy&&cb?.sector?.proxy&&ca.sector.proxy===cb.sector.proxy);
      if(!sameSic&&!sameProxy)continue;
      const sources:string[]=[]; if(sameSic)sources.push("SEC EDGAR SIC"); if(sameProxy)sources.push("Alpaca SIP historical");
      edges.push(edge("peer:"+a+":"+b,"company:"+a,"company:"+b,"peer_relationship_candidate","empirical",sources,null,"unknown","Peer relationship is supported by shared official industry classification and/or common observed industry proxy. It does not imply price prediction."));
    }
  }

  const treasury=officialBy.get("treasury") as any;
  if(treasury?.status==="live"){
    pushNode(nodes,{id:"economic:yield-curve",type:"economic",label:"10Y-2Y Treasury curve",metadata:treasury.data});
    ["industry:XLK","industry:XLF","industry:XLRE","market:SPY"].forEach(target=>{
      if(nodes.has(target))edges.push(edge("macro:curve:"+target,"economic:yield-curve",target,"economic_exposure_candidate","authoritative",["U.S. Treasury"],null,"unknown","The official Treasury curve establishes the economic variable. A second delivery channel for the same Treasury series would not count as an independent origin; predictive effect remains unproven."));
    });
  }
  const cftc=officialBy.get("cftc") as any;
  if(cftc?.status==="live"){
    pushNode(nodes,{id:"positioning:cftc",type:"positioning",label:"CFTC leveraged/dealer positioning"});
    ["market:SPY","market:QQQ","market:IWM"].forEach(target=>edges.push(edge("positioning:"+target,"positioning:cftc",target,"positioning_context_candidate","authoritative",["CFTC"],null,"unknown","Official positioning context; no price-prediction assumption.")));
  }
  const bls=officialBy.get("bls-data") as any;
  if(bls?.status==="live"){
    for(const row of bls.data??[]){
      const id="economic:bls:"+row.id; pushNode(nodes,{id,type:"economic",label:row.label,metadata:row});
      ["market:SPY","market:QQQ","market:IWM"].forEach(target=>edges.push(edge(id+":"+target,id,target,"macro_sensitivity_candidate","authoritative",["BLS"],null,"unknown","The official BLS release establishes the variable. Redistribution by another network does not create an independent source; market effect remains an untested hypothesis.")));
    }
  }

  const bea=officialBy.get("bea") as any;
  if(bea?.status==="live"){
    pushNode(nodes,{id:"economic:bea-output",type:"economic",label:"BEA national output and income",metadata:{observedAt:bea.generatedAt,rows:Array.isArray(bea.data)?bea.data.slice(0,8):[]}});
    ["market:SPY","market:QQQ","market:IWM"].forEach(target=>edges.push(edge("bea-output:"+target,"economic:bea-output",target,"economic_growth_candidate","authoritative",["BEA"],null,"unknown","Official national-account observations define a research variable; no market direction is assumed.")));
  }

  const finra=officialBy.get("finra") as any;
  if(finra?.status==="live"){
    for(const row of finra.data??[]){
      const companyId="company:"+String(row.symbol||"");
      if(!nodes.has(companyId))continue;
      const positionId="positioning:finra:"+row.symbol;
      pushNode(nodes,{id:positionId,type:"positioning",label:`${row.symbol} FINRA short-sale context`,metadata:row});
      edges.push(edge("finra-short:"+row.symbol,positionId,companyId,"short_positioning_context_candidate","authoritative",["FINRA"],null,"unknown","Official FINRA short-volume and short-interest context; it is not a directional trading signal."));
    }
  }

  const eia=officialBy.get("eia") as any;
  if(eia?.status==="live"){
    pushNode(nodes,{id:"economic:eia-petroleum",type:"economic",label:"EIA petroleum inventories",metadata:{observedAt:eia.generatedAt,rows:Array.isArray(eia.data)?eia.data.slice(0,12):[]}});
    pushNode(nodes,{id:"industry:XLE",type:"industry",label:"Energy",metadata:{proxy:"XLE"}});
    edges.push(edge("eia-energy:XLE","economic:eia-petroleum","industry:XLE","energy_fundamental_candidate","authoritative",["EIA"],null,"unknown","Official petroleum inventories define an energy research variable; price impact is not assumed."));
  }

  // A composite macro regime is independently sourced only when distinct origin
  // agencies actually responded. Mirrors or redistributors never increase this count.
  const macroSources=[treasury?.status==="live"?"U.S. Treasury":null,bls?.status==="live"?"BLS":null,bea?.status==="live"?"BEA":null].filter((x):x is string=>Boolean(x));
  if(macroSources.length>=2){
    pushNode(nodes,{id:"economic:independent-macro-regime",type:"economic",label:"Independently sourced macro regime",metadata:{sourceFamilies:macroSources,observedAt:new Date().toISOString()}});
    ["market:SPY","market:QQQ","market:IWM"].forEach(target=>edges.push(edge("independent-macro:"+target,"economic:independent-macro-regime",target,"multi_agency_macro_hypothesis","authoritative",macroSources,null,"unknown","Distinct government origin agencies jointly establish the macro context. Whether that context adds predictive information is reserved for prospective testing.")));
  }

  const arr=[...nodes.values()];
  const sourceHealth=(official?.sources??[]).map((s:any)=>({id:String(s.id),label:String(s.label),url:officialSourceUrls[String(s.id)]??null,status:String(s.status),authoritative:Boolean(s.authoritative),observedAt:String(s.generatedAt),note:String(s.note),error:s.error?String(s.error):null}));
  if([...issuerBy.values()].some(Boolean))sourceHealth.unshift({id:"sec-edgar",label:"SEC EDGAR issuer and filing data",url:"https://www.sec.gov/search-filings/edgar-application-programming-interfaces",status:"live",authoritative:true,observedAt:new Date().toISOString(),note:"Official issuer identity, SIC classification, submissions and XBRL company facts.",error:null});
  const sourceFamilies=[...new Set(edges.flatMap(e=>e.sources))].sort();
  return{
    generatedAt:new Date().toISOString(),symbols:clean,nodes:arr,edges,
    stats:{nodes:arr.length,edges:edges.length,multiSourceEdges:edges.filter(e=>e.independentSourceCount>=2).length,authoritativeEdges:edges.filter(e=>e.evidenceClass==="authoritative").length,sourceFamilies},
    sourceHealth,
    policy:{graphImpliesPrediction:false,minimumIndependentSourcesForCertification:2,sourceCountMeansIndependentOriginFamilies:true}
  };
}
