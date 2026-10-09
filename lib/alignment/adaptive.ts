import type {AlignmentResult,VariableState} from "./engine";
import type {SupervisoryResult} from "./supervisors";

export type AdaptiveGearState=VariableState;
export interface AdaptiveGear{
  id:string;
  label:string;
  score:number|null;
  state:AdaptiveGearState;
  source:string;
  note:string;
}
export interface AdaptiveIntelligenceResult{
  totalGears:12;
  observedCount:number;
  availability:number;
  score:number;
  alignedCount:number;
  mixedCount:number;
  misalignedCount:number;
  unavailableCount:number;
  gears:AdaptiveGear[];
}

function state(score:number|null):AdaptiveGearState{
  if(score==null)return "unavailable";
  if(score>=85)return "aligned";
  if(score>=60)return "mixed";
  return "misaligned";
}
function clamp(n:number){return Math.max(0,Math.min(100,n))}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}

export function evaluateAdaptiveIntelligence(
  alignment:AlignmentResult,
  supervisors:SupervisoryResult,
  ctx:any={}
):AdaptiveIntelligenceResult{
  const sup=(id:string)=>supervisors.supervisors.find(x=>x.id===id);
  const calibration=ctx.calibration??{};
  const intelligence=ctx.intelligence??{};
  const models=Array.isArray(intelligence.models)?intelligence.models:[];
  const resolved=Number(intelligence.core?.resolved??calibration.sampleCount??0);
  const marketRegime=alignment.groups.find(g=>g.group==="Market Regime");
  const setup=alignment.groups.find(g=>g.group==="Setup Quality");
  const execution=sup("execution-reality");
  const independence=sup("evidence-independence");
  const portfolio=sup("portfolio-concentration");
  const uncertainty=sup("uncertainty");

  const modelSamples=models.reduce((s:number,m:any)=>s+Number(m.sample_count??0),0);
  const weightedWin=modelSamples?models.reduce((s:number,m:any)=>s+Number(m.win_rate??0)*Number(m.sample_count??0),0)/modelSamples:null;
  const driftValues=models.map((m:any)=>Number(m.drift_score)).filter(Number.isFinite);
  const driftAvg=driftValues.length?avg(driftValues as number[]):null;
  const hasPromoted=models.some((m:any)=>/promoted|production|validated/i.test(String(m.status??"")));
  const hasDegraded=models.some((m:any)=>/degrad|drift|watch|retire/i.test(String(m.status??"")));

  const regimeFit=marketRegime?.buyScore??null;
  const factorImportanceConfidence=resolved>=100
    ?clamp(55+Math.log10(Math.max(10,resolved))*12)
    :resolved>=30?clamp(45+resolved/3):null;
  const interactionStrength=resolved>=150&&setup
    ?clamp((setup.buyScore*.45)+(alignment.buyScore*.35)+((independence?.score??50)*.20))
    :null;
  const historicalCalibration=Number(calibration.sampleCount??0)>=30
    ?clamp(Number(calibration.confidenceMultiplier??0)*100)
    :null;
  const sampleSufficiency=resolved>0?clamp(25+Math.log10(Math.max(1,resolved))*22):null;
  const outOfSample=hasPromoted&&modelSamples>=100
    ?clamp(50+(weightedWin==null?0:(weightedWin-.5)*80)+(historicalCalibration==null?0:(historicalCalibration-60)*.25))
    :null;
  const driftControl=driftAvg!=null
    ?clamp(100-driftAvg)
    :modelSamples>=50?(hasDegraded?45:75):null;
  const executionRealism=execution?.score??null;
  const uncertaintyControl=uncertainty?.score??null;
  const portfolioInteraction=portfolio?.score??null;

  const scenarioScores=[
    alignment.groups.find(g=>g.group==="Market Regime")?.buyScore,
    alignment.groups.find(g=>g.group==="Volatility & Risk")?.buyScore,
    alignment.groups.find(g=>g.group==="Timing & Execution")?.buyScore,
    alignment.groups.find(g=>g.group==="Setup Quality")?.buyScore
  ].filter((x):x is number=>typeof x==="number");
  const counterfactualRobustness=scenarioScores.length>=3
    ?clamp(Math.min(...scenarioScores)*.65+(avg(scenarioScores)??0)*.35)
    :null;

  const values:Array<[string,string,number|null,string,string]>=[
    ["regime-fit","Regime fit",regimeFit,"TradeOS Market Regime","How well the current setup fits the broader market environment."],
    ["factor-importance-confidence","Factor importance confidence",factorImportanceConfidence,"TradeOS Learning Ledger",resolved>=30?`Importance confidence based on ${resolved} resolved outcomes; true learned rankings require continued history.`:"Requires at least 30 resolved outcomes before learned factor importance receives authority."],
    ["factor-interaction-strength","Factor interaction strength",interactionStrength,"TradeOS Interaction Learner",interactionStrength==null?"Held unavailable until enough resolved outcomes exist to test combinations without overfitting.":"Measures whether combinations of factors are stronger than isolated signals."],
    ["evidence-independence","Evidence independence",independence?.score??null,"Supervisory Governor",independence?.note??"Independence cannot yet be measured."],
    ["historical-calibration","Historical calibration",historicalCalibration,"Forecast Calibration",historicalCalibration==null?"Requires at least 30 resolved forecasts.":"Measures whether stated confidence has matched actual outcomes."],
    ["sample-sufficiency","Sample sufficiency",sampleSufficiency,"TradeOS Learning Ledger",resolved?`${resolved} resolved outcomes currently support the learning layer.`:"No resolved outcomes yet."],
    ["out-of-sample-validation","Out-of-sample validation",outOfSample,"Model Scorecards",outOfSample==null?"No production-validated out-of-sample model has earned authority yet.":"Uses validated model scorecards rather than training-set performance."],
    ["model-drift-control","Model drift control",driftControl,"Model Scorecards",driftControl==null?"Insufficient model history to measure drift reliably.":hasDegraded?"At least one model is showing degradation or drift.":"No current scorecard indicates material degradation."],
    ["execution-realism","Execution realism",executionRealism,"Supervisory Governor",execution?.note??"Execution quality unavailable."],
    ["uncertainty-control","Uncertainty control",uncertaintyControl,"Supervisory Governor",uncertainty?.note??"Uncertainty estimate unavailable."],
    ["portfolio-interaction","Portfolio interaction",portfolioInteraction,"Supervisory Governor",portfolio?.note??"Portfolio interaction unavailable."],
    ["counterfactual-robustness","Counterfactual robustness",counterfactualRobustness,"TradeOS Scenario Stress",counterfactualRobustness==null?"Not enough independent scenario dimensions are observed.":"Tests whether the setup remains acceptable when major assumptions weaken."]
  ];

  const gears:AdaptiveGear[]=values.map(([id,label,score,source,note])=>({id,label,score,state:state(score),source,note}));
  const observed=gears.filter(g=>g.score!=null);
  const score=avg(observed.map(g=>g.score as number))??0;
  return{
    totalGears:12,
    observedCount:observed.length,
    availability:+(observed.length/12*100).toFixed(1),
    score:+score.toFixed(1),
    alignedCount:gears.filter(g=>g.state==="aligned").length,
    mixedCount:gears.filter(g=>g.state==="mixed").length,
    misalignedCount:gears.filter(g=>g.state==="misaligned").length,
    unavailableCount:gears.filter(g=>g.state==="unavailable").length,
    gears
  };
}
