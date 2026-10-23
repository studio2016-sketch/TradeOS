/** IV rank in [0,1]. Requires at least 252 distinct historical sessions.
 * The caller must independently validate contract, quote and point-in-time eligibility.
 */
export function computeIvRank(current:number,history:number[]){
 if(!Number.isFinite(current)||current<0||history.length<252||history.some(x=>!Number.isFinite(x)||x<0))return null;
 const lo=Math.min(...history),hi=Math.max(...history);
 if(!(hi>lo))return null;
 return Math.max(0,Math.min(1,(current-lo)/(hi-lo)));
}
