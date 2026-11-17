const name=new URL(import.meta.url).searchParams.get('name');
export async function privateGET(request){
 globalThis.__detailedCalls?.push({name,url:request?.url});
 const value=globalThis.__detailedFixtures?.[name];
 if(value instanceof Error)throw value;
 if(typeof value==='function')return value(request);
 if(value instanceof Response)return value;
 return Response.json(value??{private:'SECRET-CANARY'},{status:value===undefined?503:200});
}
