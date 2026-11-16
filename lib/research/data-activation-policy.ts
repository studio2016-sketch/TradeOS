/** Release-controlled switches. Request bodies and environment variables cannot enable these.
 * Changing either field requires a separate reviewed activation, not just deploying this draft.
 */
export type DailyInvocationApproval=Readonly<{id:string;session:string;opensAt:string;expiresAt:string}>;
export const DATA_ACTIVATION_POLICY:Readonly<{exactSlippageWrites:boolean;dailyInvocation:DailyInvocationApproval|null}>=Object.freeze({
 exactSlippageWrites:false,
 dailyInvocation:null,
});
