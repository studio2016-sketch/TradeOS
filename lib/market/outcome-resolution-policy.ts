import {horizonMs} from "./horizon";

export const OUTCOME_EVALUATION_GRACE_MS=15*60_000;

export type OutcomeResolutionState="PENDING_HORIZON"|"PENDING_GRACE"|"READY"|"TERMINAL_VOID"|"UNSUPPORTED_HORIZON";

/**
 * Frozen scheduling policy for prospective outcome resolution.
 *
 * Missing observations remain pending only while a valid end observation can
 * still arrive inside the protocol's evaluation window. Once that window has
 * closed, the forecast is terminally VOID so it cannot poison the resolver
 * queue or be silently graded from a later observation.
 */
export function outcomeResolutionState(input:{forecastAt:string;horizon:string;now:string;completeSameFeedHorizon:boolean}):OutcomeResolutionState{
 const start=Date.parse(input.forecastAt),now=Date.parse(input.now),duration=horizonMs(input.horizon);
 if(!duration||!Number.isFinite(start)||!Number.isFinite(now))return "UNSUPPORTED_HORIZON";
 const horizonAt=start+duration,deadline=horizonAt+OUTCOME_EVALUATION_GRACE_MS;
 if(now<horizonAt)return "PENDING_HORIZON";
 if(input.completeSameFeedHorizon)return "READY";
 if(now<=deadline)return "PENDING_GRACE";
 return "TERMINAL_VOID";
}

