import {db} from "../db";
export type CollectorReceipt={collector:string;status:"finished"|"failed";received:number;saved:number;details:Record<string,unknown>};
/** Persist a receipt without disguising an ingestion failure as success. */
export async function recordCollectorReceipt(receipt:CollectorReceipt){
 const sql=db();
 await sql`insert into tradeos_collector_runs(collector,status,received,saved,details)
 values(${receipt.collector},${receipt.status},${receipt.received},${receipt.saved},${JSON.stringify(receipt.details)}::jsonb)`;
}
export function failureDetail(error:unknown){return error instanceof Error?error.message:"unknown_error";}
