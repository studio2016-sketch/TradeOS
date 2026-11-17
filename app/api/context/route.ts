import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";import {buildMarketContext} from "../../../lib/market/context";export const dynamic="force-dynamic";
async function privateGET(req:Request){const s=(new URL(req.url).searchParams.get("symbol")||"NVDA").toUpperCase();try{const context=await buildMarketContext(s);return NextResponse.json({mode:context?"provider_context":"unconfigured",context});}catch(e){return NextResponse.json({mode:"degraded",context:null,error:e instanceof Error?e.message:String(e)},{status:502});}}
export const GET=withPrivateRead(privateGET);
