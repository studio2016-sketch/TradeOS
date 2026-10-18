export type GraphNodeKind="instrument"|"model"|"factor"|"source"|"industry"|"company"|"event";
export type GraphEdgeKind="EVALUATED_BY"|"USES_FACTOR"|"OBSERVED_FROM"|"BELONGS_TO"|"EXPOSED_TO"|"REPORTED_BY";
export type GraphNode={id:string;kind:GraphNodeKind;label:string};
export type GraphEdge={from:string;to:string;relation:GraphEdgeKind;source:string;observedAt:string|null;publishedAt:string|null;collectedAt:string|null;status:"OBSERVED"|"UNDATED"|"UNVERIFIED";evidenceId:string|null};
export type ResearchEvidence={symbol:string;modelVersion:string;source:string;forecastTime:string;sourceObservedAt:string|null;factorLabels:string[];forecastId:string};
const id=(kind:GraphNodeKind,label:string)=>kind+":"+label;
const valid=(v:string|null)=>v!==null&&Number.isFinite(Date.parse(v));
/**
 * An evidence graph, NOT a claimed supplier/customer network. No inferred business
 * relationships are created without dated external primary-source evidence.
 */
export function graphFromResearch(rows:ResearchEvidence[]){
 const nodes=new Map<string,GraphNode>(),edges:GraphEdge[]=[];
 function node(kind:GraphNodeKind,label:string){const key=id(kind,label);nodes.set(key,{id:key,kind,label});return key}
 function edge(from:string,to:string,relation:GraphEdgeKind,row:ResearchEvidence){
  edges.push({from,to,relation,source:row.source,observedAt:row.sourceObservedAt,
   publishedAt:null,collectedAt:row.forecastTime,status:valid(row.sourceObservedAt)?"OBSERVED":"UNDATED",evidenceId:row.forecastId});
 }
 for(const row of rows){
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(row.symbol)||!row.modelVersion||!row.source)continue;
  const ticker=node("instrument",row.symbol),model=node("model",row.modelVersion),source=node("source",row.source);
  edge(ticker,model,"EVALUATED_BY",row);edge(ticker,source,"OBSERVED_FROM",row);
  for(const factor of [...new Set(row.factorLabels)].filter(x=>x&&x.length<=120)){
   const factorId=node("factor",factor);edge(model,factorId,"USES_FACTOR",row);
  }
 }
 return {nodes:[...nodes.values()],edges,metadata:{evidenceRows:rows.length,
  undatedEdges:edges.filter(e=>e.status==="UNDATED").length,
  corporateRelationshipEdges:0,
  limitations:["Relationships depict recorded research lineage only.","No supplier, customer, industry or ownership relationship is inferred without dated independent evidence."]}};
}
