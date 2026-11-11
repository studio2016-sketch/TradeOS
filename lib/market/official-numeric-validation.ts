/** Strict provider numeric parsing: missing or malformed data is not zero. */
export function officialNumber(value:unknown):number|null{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  if(typeof value!=="string")return null;
  const raw=value.trim();
  if(!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))return null;
  const decimal=raw.replace(/,/g,"");
  const parsed=Number(decimal);
  if(!Number.isFinite(parsed)||(parsed===0&&/[1-9]/.test(decimal.split(/[eE]/)[0])))return null;
  return parsed;
}

export function officialCount(value:unknown):number|null{
  const parsed=officialNumber(value);
  if(parsed===null||!Number.isSafeInteger(parsed)||parsed<0)return null;
  if(typeof value==="string"){
    // Check integrality before binary rounding can hide a fractional source count.
    const [mantissa,exponent="0"]=value.trim().replace(/,/g,"").toLowerCase().split("e");
    const fractionLength=mantissa.split(".")[1]?.length??0;
    const digits=mantissa.replace(/[+.-]/g,"").replace(/^0+/,"");
    const decimalPlaces=fractionLength-Number(exponent);
    if(digits&&decimalPlaces>0&&(decimalPlaces>=digits.length||!/^[0]+$/.test(digits.slice(-decimalPlaces))))return null;
  }
  return parsed;
}

/** A missing facility count must not become a zero contribution to a total. */
export function sumOfficialCounts(rows:unknown[],field:string):number|null{
  if(!rows.length)return null;
  let total=0;
  for(const row of rows){
    const value=officialCount(row&&typeof row==="object"?(row as Record<string,unknown>)[field]:undefined);
    if(value===null)return null;
    total+=value;
    if(!Number.isSafeInteger(total))return null;
  }
  return total;
}

export function finiteOfficialCalculation(value:number):number|null{
  return Number.isFinite(value)?value:null;
}
