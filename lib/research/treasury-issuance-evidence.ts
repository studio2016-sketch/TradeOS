import type {PersistableEvidence} from "./persist-evidence";

export type TreasuryAuctionRow={
 record_date?:string;auction_date?:string;cusip?:string;security_type?:string;security_term?:string;total_accepted?:string
};

export function trailingAcceptedIssuance(rows:TreasuryAuctionRow[],now=new Date(),days=7){
 const cutoff=now.getTime()-days*86400000;
 const eligible=rows.flatMap(row=>{
  const auction=Date.parse(String(row.auction_date??"")+"T00:00:00Z");
  const value=Number(row.total_accepted);
  return Number.isFinite(auction)&&auction>=cutoff&&auction<=now.getTime()&&Number.isFinite(value)&&value>=0
   ?[{row,auction,value}]:[];
 });
 if(!eligible.length)return null;
 return {
  value:eligible.reduce((sum,x)=>sum+x.value,0),
  observedAt:new Date(Math.max(...eligible.map(x=>x.auction))).toISOString(),
  count:eligible.length,
  cusips:eligible.map(x=>String(x.row.cusip??"")).filter(Boolean),
  windowDays:days
 };
}

export async function observedTreasuryIssuanceEvidence(now=new Date()){
 const availableAt=now.toISOString();
 const start=new Date(now.getTime()-14*86400000).toISOString().slice(0,10);
 const url=new URL("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query");
 url.searchParams.set("fields","record_date,cusip,security_type,security_term,auction_date,total_accepted");
 url.searchParams.set("filter",`auction_date:gte:${start}`);
 url.searchParams.set("sort","-auction_date");
 url.searchParams.set("page[size]","100");
 const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"}});
 if(!res.ok)throw new Error(`Treasury Fiscal Data auctions HTTP ${res.status}`);
 const payload=await res.json() as {data?:TreasuryAuctionRow[]};
 const rows=Array.isArray(payload.data)?payload.data:[];
 const measured=trailingAcceptedIssuance(rows,now,7);
 const candidates:PersistableEvidence[]=[];
 if(measured){
  candidates.push({
   factor:"treasury_issuance",value:measured.value,source:"U.S. Treasury Fiscal Data: auctions_query",
   subject:"US_TREASURY_AUCTIONS",observedAt:measured.observedAt,availableAt,domain:"macro",
   metadata:{method:"sum_total_accepted_for_auctions_in_trailing_7_calendar_days",unit:"USD",auctionCount:measured.count,cusips:measured.cusips,windowDays:measured.windowDays,backtestEligible:false}
  });
 }
 return {retrievedAt:availableAt,rows:rows.length,candidates,measured:measured!==null};
}
