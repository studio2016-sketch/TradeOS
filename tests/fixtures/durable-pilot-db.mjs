export function db(){
 const driver=(strings,...values)=>({strings,values});
 driver.transaction=async(queries,options)=>{
  const f=globalThis.__receiptDb;f.calls.push({queries,readOnly:options.readOnly,signal:options.fetchOptions.signal});
  if(f.fail)throw Error('private database credential');
  return [[]];
 };
 return driver;
}
