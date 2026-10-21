import {NextResponse} from "next/server";
import {auth} from "../../../../lib/auth/server";
import {db,hasDatabase} from "../../../../lib/db";
import {observedMacroEvidence} from "../../../../lib/research/official-macro-evidence";
import {storedFactorEvidence} from "../../../../lib/research/stored-factor-evidence";
import {auditEvidence,type Evidence} from "../../../../lib/research/source-vintage-audit";
import {bestSnapshots} from "../../../../lib/market/live";
import {alpacaOptionSurface} from "../../../../lib/market/options";
import {alpacaDailyHistory} from "../../../../lib/research/market-factor-history";
import {calculateMarketFactors,calculateRelativeMarketFactors} from "../../../../lib/research/market-factor-engine";

export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(){
 const headers={"Cache-Control":"private, no-store"};
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const sql=db();
  const owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=="admin"||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const requestedAt=new Date().toISOString();
  const [rows,macro,snapshots,symbolHistory,benchmarkHistory,treasuryHistory]=await Promise.all([
   sql`select symbol,market_time,recorded_at,provider,features,news from tradeos_acceleration_observations order by market_time desc limit 1500`,
   observedMacroEvidence(),
   bestSnapshots(["SPY"]).catch(()=>({snapshots:[]} as any)),
   alpacaDailyHistory("NVDA",requestedAt),
   alpacaDailyHistory("SPY",requestedAt),
   alpacaDailyHistory("TLT",requestedAt)
  ]);
  const spot=Number(snapshots.snapshots?.[0]?.price),options=await alpacaOptionSurface("SPY",Number.isFinite(spot)?spot:undefined).catch(()=>null);
  const receivedAt=new Date().toISOString(),optionEvidence:Evidence[]=[],currentMarketEvidence:Evidence[]=[];
  if(options?.atmIv!=null)optionEvidence.push({factor:"implied_vol_atm",value:Number(options.atmIv),domain:"option",source:`Alpaca Options:${options.feed}`,subject:"SPY",observedAt:options.generatedAt,availableAt:receivedAt});
  if(options?.putCallIvSkew!=null)optionEvidence.push({factor:"iv_skew",value:Number(options.putCallIvSkew),domain:"option",source:`Alpaca Options:${options.feed}`,subject:"SPY",observedAt:options.generatedAt,availableAt:receivedAt});
  const symbolFactors=calculateMarketFactors(symbolHistory.bars),relativeFactors=calculateRelativeMarketFactors(symbolHistory.bars,benchmarkHistory.bars),treasuryFactors=calculateMarketFactors(treasuryHistory.bars);
  for(const [factor,item] of Object.entries({...symbolFactors,...relativeFactors})){
   if(!["price_acceleration","beta","rolling_correlation"].includes(factor)||item.value==null||!item.asOf)continue;
   const source=factor==="beta"||factor==="rolling_correlation"?`${symbolHistory.source}+${benchmarkHistory.source}:completed-bars`:`${symbolHistory.source}:completed-bars`;
   currentMarketEvidence.push({factor,value:item.value,domain:"stock",source,subject:"NVDA",observedAt:item.asOf,availableAt:receivedAt});
  }
  const treasuryReturn=treasuryFactors.return_5d;
  if(treasuryReturn?.value!=null&&treasuryReturn.asOf)currentMarketEvidence.push({factor:"treasury_etf_return",value:treasuryReturn.value,domain:"stock",source:`${treasuryHistory.source}:completed-bars`,subject:"TLT",observedAt:treasuryReturn.asOf,availableAt:receivedAt});
  const stored=storedFactorEvidence((rows as any[]).map(row=>({...row,market_time:new Date(row.market_time).toISOString(),recorded_at:new Date(row.recorded_at).toISOString()})));
  const audit=auditEvidence([...stored,...macro.factors,...optionEvidence,...currentMarketEvidence],receivedAt);
  return NextResponse.json({generatedAt:receivedAt,measured:audit.measured,defined:120,operationalTarget:60,targetMet:audit.measured>=60,coveragePct:+(audit.measured/120*100).toFixed(1),domains:audit.domains,evidence:audit.evidence,missing:audit.missing,rejected:audit.rejected,recordsExamined:rows.length,officialMacroMeasured:macro.measured,optionFactorsMeasured:optionEvidence.length,currentMarketFactorsMeasured:currentMarketEvidence.length,certifiedPredictiveFactors:0,approvedForTrading:false,warning:"Coverage combines distinct current stock, option, news and macro measurements. It is not 60 factors for every ticker and does not establish predictive usefulness or profitability."},{headers});
 }catch(error){return NextResponse.json({error:"Live factor coverage unavailable",reason:error instanceof Error?error.message:"unknown"},{status:503,headers});}
}
