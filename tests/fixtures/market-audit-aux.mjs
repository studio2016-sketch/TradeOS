export async function readStrictProviderClock(){return globalThis.__marketClock?.()??null;}
export function brokerReadStatus(){return {enabled:true};}
