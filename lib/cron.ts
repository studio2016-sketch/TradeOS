export function authorizeCron(req:Request){
  const expected=process.env.CRON_SECRET;
  const auth=req.headers.get("authorization");
  return Boolean(expected && auth===`Bearer ${expected}`);
}
