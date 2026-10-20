export type Transmission={cause:string;effect:string;direction:"positive"|"negative"|"ambiguous";mechanism:string;delay:"immediate"|"days"|"weeks"|"months";conditions:string[]};
export const transmissionLibrary:Transmission[]=[
{cause:"policy_rate_up",effect:"discount_rate",direction:"positive",mechanism:"Higher policy rates may increase discount rates",delay:"days",conditions:["transmission_to_yields"]},
{cause:"discount_rate",effect:"long_duration_equity_valuation",direction:"negative",mechanism:"Higher discount rates can lower present values",delay:"days",conditions:["cashflow_duration","risk_premia"]},
{cause:"energy_supply_disruption",effect:"oil_price",direction:"positive",mechanism:"Reduced expected supply may raise oil risk premiums",delay:"immediate",conditions:["inventory","demand"]},
{cause:"oil_price",effect:"transport_costs",direction:"positive",mechanism:"Fuel-sensitive operations face cost changes",delay:"weeks",conditions:["hedging","pass_through"]},
{cause:"oil_price",effect:"energy_producer_revenue",direction:"positive",mechanism:"Higher realized selling prices may improve revenue",delay:"weeks",conditions:["production","hedging"]},
{cause:"usd_strength",effect:"foreign_revenue_translation",direction:"negative",mechanism:"A stronger dollar may lower translated overseas revenue",delay:"months",conditions:["geographic_sales","fx_hedges"]},
{cause:"credit_spread_widening",effect:"funding_cost",direction:"positive",mechanism:"Risk premiums can raise refinancing expenses",delay:"weeks",conditions:["maturities","leverage"]},
{cause:"funding_cost",effect:"leveraged_company_equity",direction:"negative",mechanism:"Debt costs and distress risk can pressure valuations",delay:"months",conditions:["free_cashflow","debt_maturity"]},
{cause:"semiconductor_demand",effect:"chipmaker_revenue",direction:"positive",mechanism:"Higher unit demand may improve sales",delay:"months",conditions:["capacity","pricing","exports"]}
];
export function traceTransmission(start:string,maxDepth=3){
 if(!start||maxDepth<1||maxDepth>5)throw Error("Invalid trace request");
 const paths:{nodes:string[];edges:Transmission[]}[]=[];
 const visit=(node:string,nodes:string[],edges:Transmission[])=>{
  if(edges.length>=maxDepth)return;
  for(const edge of transmissionLibrary.filter(x=>x.cause===node)){
   if(nodes.includes(edge.effect))continue;
   const next={nodes:[...nodes,edge.effect],edges:[...edges,edge]};
   paths.push(next);visit(edge.effect,next.nodes,next.edges);
  }
 };
 visit(start,[start],[]);
 return {paths,verifiedPredictiveEffect:false,warning:"Mechanistic hypotheses only. Sign, magnitude, and timing are not empirically established."};
}
