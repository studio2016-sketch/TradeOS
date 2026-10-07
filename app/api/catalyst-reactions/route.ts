import {NextResponse} from "next/server";
import {hasDatabase} from "../../../lib/db";
import {catalystReactions} from "../../../lib/market/reactions";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  if(!hasDatabase()) return NextResponse.json({mode:"database_unconfigured",reactions:[]});
  const symbol=new URL(req.url).searchParams.get("symbol")?.toUpperCase();
  const reactions=await catalystReactions(symbol);
  return NextResponse.json({mode:"observed",reactions,generatedAt:new Date().toISOString()});
}