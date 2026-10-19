import type {FinancialKnowledgeGraph,GraphEdge} from "./knowledgeGraph";

export type HypothesisState="candidate"|"testing"|"validated"|"rejected"|"insufficient";
export interface FactorHypothesis{
  id:string;edgeId:string;label:string;
  from:string;to:string;relation:string;
  nullHypothesis:string;alternativeHypothesis:string;
  requiredIndependentSources:number;
  sourceCount:number;
  sampleFloor:number;
  horizons:string[];
  tests:string[];
  state:HypothesisState;
  predictiveAuthority:false;
  graphStrength:number|null;
  createdAt:string;
}
export interface FactorDiscoveryBatch{
  generatedAt:string;
  hypotheses:FactorHypothesis[];
  policy:{graphRelationshipIsNotPrediction:true;defaultPredictiveAuthority:false;certificationRequired:true};
}

function make(e:GraphEdge):FactorHypothesis{
  const macro=/macro|economic|yield|inflation|unemployment|payroll/i.test(e.relation+" "+e.from+" "+e.to);
  const positioning=/positioning/i.test(e.relation+" "+e.from);
  const correlation=/correlation/i.test(e.relation);
  const industry=/industry/i.test(e.relation+" "+e.to);
  const label=macro?("Does "+e.from+" add incremental information about "+e.to+"?"):
    positioning?("Does "+e.from+" improve timing or risk estimates for "+e.to+"?"):
    industry?("Does industry behavior add incremental information for "+e.from+"?"):
    correlation?"Is the observed relationship stable and useful out of sample?":
    ("Does "+e.relation+" contain incremental information?");
  return{
    id:"hyp:"+e.id,edgeId:e.id,label,from:e.from,to:e.to,relation:e.relation,
    nullHypothesis:"After controlling for existing TradeOS factors, this relationship adds no stable out-of-sample predictive information.",
    alternativeHypothesis:"After controlling for existing TradeOS factors, this relationship adds stable incremental information in at least one pre-specified horizon or regime.",
    requiredIndependentSources:2,
    sourceCount:e.independentSourceCount,
    sampleFloor:macro?120:positioning?100:80,
    horizons:["30m","1d","5d","20d"],
    tests:[
      "point-in-time feature freeze",
      "chronological walk-forward split",
      "untouched out-of-sample holdout",
      "incremental-vs-baseline comparison",
      "regime stratification",
      "transaction-cost sensitivity where executable",
      "multiple-testing correction",
      "stability / drift check"
    ],
    state:e.independentSourceCount>=2?"candidate":"insufficient",
    predictiveAuthority:false,
    graphStrength:e.strength,
    createdAt:new Date().toISOString()
  };
}

export function graphHypotheses(graph:FinancialKnowledgeGraph):FactorDiscoveryBatch{
  const eligible=graph.edges.filter(e=>!/^issuer:/.test(e.id));
  const hypotheses=eligible.map(make);
  return{
    generatedAt:new Date().toISOString(),hypotheses,
    policy:{graphRelationshipIsNotPrediction:true,defaultPredictiveAuthority:false,certificationRequired:true}
  };
}
