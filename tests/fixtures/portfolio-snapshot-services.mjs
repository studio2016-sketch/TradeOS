// Synthetic in-memory services only. No broker, network or persistence operations.
export async function alpacaBrokerState(){return globalThis.__portfolioSnapshot;}
export async function historicalBars(){return [];}
