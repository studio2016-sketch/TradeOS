export function authorizeIngest(req:Request){
  const expected=process.env.TRADEOS_INGEST_TOKEN;
  if(!expected) return false;
  const supplied=req.headers.get("x-tradeos-ingest-token");
  return Boolean(supplied && supplied===expected);
}
