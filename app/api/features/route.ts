import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";import {featureSet} from "../../../lib/market/features";export const dynamic="force-dynamic";
async function privateGET(req:Request){const s=(new URL(req.url).searchParams.get("symbol")||"NVDA").toUpperCase();try{const features=await featureSet(s);return NextResponse.json({mode:features?"provider_history":"unconfigured",features});}catch(e){return NextResponse.json({mode:"degraded",features:null,error:e instanceof Error?e.message:String(e)},{status:502});}}
export const GET=withPrivateRead(privateGET);
