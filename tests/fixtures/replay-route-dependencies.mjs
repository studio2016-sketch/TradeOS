export const NextResponse={json:(body,init)=>Response.json(body,init)};
export const historicalBars=(...args)=>globalThis.__replayHistory(...args);
