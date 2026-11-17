/** Authenticated browser CSRF boundary; request cannot supply the approval, session or universe. */
export function ownerDailyPilotRequest(req:Request){
 return req.method==='POST'&&new URL(req.url).origin==='https://tradeos-lac.vercel.app'&&!new URL(req.url).search&&
  req.headers.get('origin')==='https://tradeos-lac.vercel.app'&&req.headers.get('sec-fetch-site')==='same-origin'&&
  req.headers.get('x-tradeos-daily-pilot')==='owner-pilot-v1';
}
