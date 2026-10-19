import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
/** Fail-closed route: no browser can mint object write permissions. */
export async function POST(){
 return NextResponse.json(
  {status:"authentication_required",uploadsEnabled:false,reason:"Verified user identity and private object signing are required before uploads."},
  {status:403,headers:{"Cache-Control":"no-store"}}
 );
}
