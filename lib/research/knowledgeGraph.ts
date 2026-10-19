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
  stats:{nodes:number;edges:number;multiSourceEdges:number;authoritativeEdges:number};
  policy:{graphImpliesPrediction:false;minimumIndependentSourcesForCertification:number};
}

const sectorNames:Record<string,string>={
  SMH:"Semiconductors",XLK:"Technology",XLC:"Communication Services",XLY:"Consumer Discretionary",
  XLF:"Financials",XLE:"Energy",XLV:"Health Care",XLI:"Industrials",XLP:"Consumer Staples",
  XLU:"Utilities",XLB:"Materials",XLRE:"Real Estate"
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
      if(nodes.has(target))edges.push(edge("macro:curve:"+target,"economic:yield-curve",target,"economic_exposure_candidate","authoritative",["U.S. Treasury","FRED"],null,"unknown","Independent official rate sources establish the economic variable; whether it predicts this target remains a research question."));
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
      ["market:SPY","market:QQQ","market:IWM"].forEach(target=>edges.push(edge(id+":"+target,id,target,"macro_sensitivity_candidate","authoritative",["BLS","FRED"],null,"unknown","Macro release relationship is a hypothesis candidate only; independent official data sources support the variable, not the market effect.")));
    }
  }

  const arr=[...nodes.values()];
  return{
    generatedAt:new Date().toISOString(),symbols:clean,nodes:arr,edges,
    stats:{nodes:arr.length,edges:edges.length,multiSourceEdges:edges.filter(e=>e.independentSourceCount>=2).length,authoritativeEdges:edges.filter(e=>e.evidenceClass==="authoritative").length},
    policy:{graphImpliesPrediction:false,minimumIndependentSourcesForCertification:2}
  };
}
