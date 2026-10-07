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


export interface SecIssuerContext{
  symbol:string;
  company:string;
  cik:string;
  publicFloatUsd:number|null;
  sharesOutstanding:number|null;
  floatStructureScore:number|null;
  ownershipFilingCount365d:number;
  institutionalParticipationScore:number|null;
  latestOwnershipFilingDate:string|null;
  note:string;
  generatedAt:string;
}

function latestFactValue(facts:any,tag:string,unit:string){
  const rows=facts?.facts?.dei?.[tag]?.units?.[unit]??[];
  if(!Array.isArray(rows)||!rows.length)return null;
  const valid=rows.filter((x:any)=>Number.isFinite(Number(x.val))).sort((a:any,b:any)=>String(b.filed??b.end??"").localeCompare(String(a.filed??a.end??"")));
  return valid.length?Number(valid[0].val):null;
}

export async function secIssuerContext(symbol:string):Promise<SecIssuerContext|null>{
  const map=await tickerMap();
  const company=map.get(symbol.toUpperCase());
  if(!company)return null;
  const [factsRes,subRes]=await Promise.all([
    fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`,{headers:SEC_HEADERS,next:{revalidate:3600}}),
    fetch(`https://data.sec.gov/submissions/CIK${company.cik}.json`,{headers:SEC_HEADERS,next:{revalidate:300}})
  ]);
  const facts=factsRes.ok?await factsRes.json() as any:null;
  const sub=subRes.ok?await subRes.json() as any:null;
  const publicFloatUsd=facts?latestFactValue(facts,"EntityPublicFloat","USD"):null;
  const sharesOutstanding=facts?latestFactValue(facts,"EntityCommonStockSharesOutstanding","shares"):null;
  let floatStructureScore:number|null=null;
  if(publicFloatUsd!=null){
    floatStructureScore=publicFloatUsd>=50e9?92:publicFloatUsd>=10e9?88:publicFloatUsd>=2e9?80:publicFloatUsd>=500e6?70:publicFloatUsd>=100e6?58:40;
  }else if(sharesOutstanding!=null){
    floatStructureScore=sharesOutstanding>=500e6?82:sharesOutstanding>=100e6?76:sharesOutstanding>=20e6?66:sharesOutstanding>=5e6?55:38;
  }
  const recent=sub?.filings?.recent;
  let ownershipFilingCount365d=0,latestOwnershipFilingDate:string|null=null;
  if(recent?.form){
    const cutoff=Date.now()-365*24*60*60*1000;
    for(let i=0;i<recent.form.length;i++){
      const form=String(recent.form[i]??"");
      const filed=String(recent.filingDate?.[i]??"");
      if(!/13[DG]/i.test(form))continue;
      const t=new Date(filed+"T00:00:00Z").getTime();
      if(Number.isFinite(t)&&t>=cutoff){
        ownershipFilingCount365d++;
        if(!latestOwnershipFilingDate||filed>latestOwnershipFilingDate)latestOwnershipFilingDate=filed;
      }
    }
  }
  const institutionalParticipationScore=ownershipFilingCount365d?Math.min(90,58+ownershipFilingCount365d*6):null;
  return{
    symbol:symbol.toUpperCase(),company:company.title,cik:company.cik,publicFloatUsd,sharesOutstanding,floatStructureScore,
    ownershipFilingCount365d,institutionalParticipationScore,latestOwnershipFilingDate,
    note:"SEC public-float/company-facts plus recent 13D/13G filing activity. Ownership filing activity is a participation proxy, not complete institutional ownership.",
    generatedAt:new Date().toISOString()
  };
}
