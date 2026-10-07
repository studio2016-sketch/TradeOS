export interface SecCatalyst{
  id:string;
  symbol:string;
  cik:string;
  company:string;
  form:string;
  filedAt:string;
  acceptedAt?:string;
  reportDate?:string;
  description:string;
  filingUrl:string;
  source:"SEC EDGAR";
  sourceQuality:number;
  impact:"high"|"medium"|"low";
}

const SEC_HEADERS={
  "User-Agent":"TradeOS market research contact: studio2016@icloud.com",
  "Accept-Encoding":"gzip, deflate",
  "Accept":"application/json"
};

let tickerCache:{expires:number,map:Map<string,{cik:string,title:string}>}|null=null;

async function tickerMap(){
  if(tickerCache && Date.now()<tickerCache.expires) return tickerCache.map;
  const res=await fetch("https://www.sec.gov/files/company_tickers.json",{headers:SEC_HEADERS,next:{revalidate:86400}});
  if(!res.ok) throw new Error(`SEC ticker map HTTP ${res.status}`);
  const json=await res.json() as Record<string,{cik_str:number,ticker:string,title:string}>;
  const map=new Map<string,{cik:string,title:string}>();
  for(const row of Object.values(json)){
    map.set(row.ticker.toUpperCase(),{cik:String(row.cik_str).padStart(10,"0"),title:row.title});
  }
  tickerCache={expires:Date.now()+24*60*60*1000,map};
  return map;
}

function impactForForm(form:string):SecCatalyst["impact"]{
  if(["8-K","10-K","10-Q","20-F","6-K","S-1"].includes(form)) return "high";
  if(["4","13D","13D/A","13G","13G/A","S-3","424B2","424B3","424B5"].includes(form)) return "medium";
  return "low";
}

export async function latestSecCatalysts(symbols:string[],limitPerSymbol=5):Promise<SecCatalyst[]>{
  const map=await tickerMap();
  const clean=[...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
  const out:SecCatalyst[]=[];
  for(const symbol of clean){
    const company=map.get(symbol);
    if(!company) continue;
    const res=await fetch(`https://data.sec.gov/submissions/CIK${company.cik}.json`,{headers:SEC_HEADERS,next:{revalidate:60}});
    if(!res.ok) continue;
    const data=await res.json() as any;
    const recent=data?.filings?.recent;
    if(!recent?.accessionNumber) continue;
    const cikNoZeros=String(Number(company.cik));
    for(let i=0;i<Math.min(recent.accessionNumber.length,25)&&out.filter(x=>x.symbol===symbol).length<limitPerSymbol;i++){
      const form=String(recent.form?.[i]??"");
      const impact=impactForForm(form);
      if(impact==="low") continue;
      const accession=String(recent.accessionNumber[i]);
      const accessionCompact=accession.replace(/-/g,"");
      const primary=String(recent.primaryDocument?.[i]??"");
      out.push({
        id:`${company.cik}-${accession}`,
        symbol,
        cik:company.cik,
        company:company.title,
        form,
        filedAt:String(recent.filingDate?.[i]??""),
        acceptedAt:String(recent.acceptanceDateTime?.[i]??recent.filingDate?.[i]??""),
        reportDate:String(recent.reportDate?.[i]??""),
        description:String(recent.primaryDocDescription?.[i]??form),
        filingUrl:`https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accessionCompact}/${primary}`,
        source:"SEC EDGAR",
        sourceQuality:1,
        impact
      });
    }
  }
  return out.sort((a,b)=>b.filedAt.localeCompare(a.filedAt));
}
