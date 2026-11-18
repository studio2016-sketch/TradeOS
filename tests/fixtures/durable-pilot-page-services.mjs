export async function currentPrivateReadStatus(){globalThis.__receiptPage.calls.push('authorize');return globalThis.__receiptPage.status;}
export async function currentPilotReceipt(){globalThis.__receiptPage.calls.push('receipt');return {status:'none',checkedAt:'2026-11-18T04:00:00.000Z',certified:false,ordersAllowed:false};}
export function redirect(path){throw Error('redirect:'+path)}
