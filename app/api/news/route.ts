import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";
import {curatedNews} from "../../../lib/market/news";
export const dynamic="force-dynamic";
async function privateGET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")??"NVDA,AMD,PLTR,SPY,QQQ,IWM").split(",");
  try{
    const result=await curatedNews(symbols,40);
    return NextResponse.json({
      mode:result.news.length?"provider_news":"unconfigured",
      generatedAt:new Date().toISOString(),
      news:result.news,
      errors:result.errors
    });
  }catch(error){
    return NextResponse.json({mode:"degraded",news:[],error:error instanceof Error?error.message:String(error)},{status:502});
  }
}

export const GET=withPrivateRead(privateGET);
