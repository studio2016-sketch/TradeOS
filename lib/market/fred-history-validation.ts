export interface FredHistoryPoint {date:string;value:number}
export type FredCsvResult =
  | {status:"ok"|"empty";points:FredHistoryPoint[]}
  | {status:"error";points:[];error:string};

const DECIMAL=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function validDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

/** FRED graph CSV is a two-column, current-vintage observation series.
 * Reject the entire response on malformed evidence instead of using an older
 * surviving row as if it were the latest valid provider observation.
 */
export function parseFredHistoryCsv(text:string,series:string,asOf:Date):FredCsvResult{
  const fail=(error:string):FredCsvResult=>({status:"error",points:[],error});
  if(!Number.isFinite(asOf.getTime()))return fail("FRED observation cutoff is invalid");
  const today=asOf.toISOString().slice(0,10);
  const lines=text.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
  const header=lines[0]?.split(",").map(value=>value.trim());
  if(header?.length!==2||!["observation_date","DATE"].includes(header[0])||header[1]!==series){
    return fail("FRED CSV header does not match the requested series");
  }
  const points:FredHistoryPoint[]=[];
  const dates=new Set<string>();
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const columns=lines[i].split(",").map(value=>value.trim());
    if(columns.length!==2)return fail(`FRED CSV row ${i+1} must have exactly two columns`);
    const [date,raw]=columns;
    if(!validDate(date)||date>today)return fail(`FRED CSV row ${i+1} has an invalid or future observation date`);
    // Even identical duplicates are rejected: one source date must identify one row.
    if(dates.has(date))return fail(`FRED CSV row ${i+1} repeats an observation date`);
    dates.add(date);
    // Explicit provider missing markers remain missing, never zero.
    if(raw===""||raw===".")continue;
    const value=Number(raw);
    if(!DECIMAL.test(raw)||!Number.isFinite(value)||(value===0&&/[1-9]/.test(raw.split(/[eE]/)[0])))return fail(`FRED CSV row ${i+1} has an invalid numeric observation`);
    points.push({date,value});
  }
  points.sort((a,b)=>a.date.localeCompare(b.date));
  return {status:points.length?"ok":"empty",points};
}
