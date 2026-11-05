type FilingPeriod={start?:string;end:string;filed:string;accession:string};
type CashflowInput={value:number;provenance?:FilingPeriod};

/** Annual CFO and capex must come from the same period and accession.
 * No missing cash flow is replaced with zero, and no period is annualized.
 */
export function alignedCashflowYield(cfo:CashflowInput,capex:CashflowInput,marketCap:number){
 if(![cfo.value,capex.value,marketCap].every(Number.isFinite)||marketCap<=0)return null;
 const a=cfo.provenance,b=capex.provenance;
 if(!a||!b||!a.start||typeof a.accession!=="string"||!a.accession.trim()||a.start!==b.start||a.end!==b.end||a.accession!==b.accession||a.filed!==b.filed)return null;
 const date=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
 if(![a.start,a.end,a.filed].every(date))return null;
 const duration=(Date.parse(a.end)-Date.parse(a.start))/86400000;
 if(duration<300||duration>390||Date.parse(a.filed)<Date.parse(a.end))return null;
 const freeCashFlow=cfo.value-Math.abs(capex.value),value=freeCashFlow/marketCap;
 if(!Number.isFinite(freeCashFlow)||!Number.isFinite(value))return null;
 return {freeCashFlow,value,periodStart:a.start,periodEnd:a.end,accession:a.accession,filed:a.filed};
}
