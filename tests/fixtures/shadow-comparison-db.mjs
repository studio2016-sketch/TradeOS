export function db(){return async(strings,...values)=>{
 const query=strings.join('?');globalThis.__shadowComparison.calls.push({query,values});
 if(query.includes('with b as'))return globalThis.__shadowComparison.pairs;
 if(query.includes('immutable_decision_records'))return [];
 return globalThis.__shadowComparison.rows;
};}
