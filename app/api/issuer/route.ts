import {NextResponse} from "next/server";
import {secIssuerContext} from "../../../lib/market/sec";
export const dynamic="force-dynamic";
export async function GET(req:Request){const s=(new URL(req.url).searchParams.get("symbol")||"NVDA").toUpperCase();try{const context=await secIssuerContext(s);return NextResponse.json({mode:context?"authoritative_sec":"unavailable",context});}catch(e){return NextResponse.json({mode:"degraded",context:null,error:e instanceof Error?e.message:String(e)},{status:502});}}