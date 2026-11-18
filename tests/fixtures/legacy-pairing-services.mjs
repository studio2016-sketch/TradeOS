export const authorizeCron=()=>globalThis.__legacyPairing.authorized;
export const hasDatabase=()=>true;
export const failureDetail=()=> 'fixture_failure';
export async function recordCollectorReceipt(){}
export function db(){return async(strings,...values)=>{
 const query=strings.join('?');const f=globalThis.__legacyPairing;f.queries.push(query);
 if(query.includes('with b as'))return f.pairs;
 if(query.includes("event_type='phase4_validation_snapshot'")&&query.trim().startsWith('select'))return [{payload:f.phase4,created_at:'2026-11-18T00:00:00Z'}];
 if(query.trim().startsWith('insert')){f.writes.push({query,values});return [];}
 if(query.includes('count('))return [{}];
 return [];
};}
