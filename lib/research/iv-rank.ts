export function computeIvRank(current:number,history:number[]){
 const clean=history.filter(Number.isFinite);
 if(!Number.isFinite(current)||clean.length<20)return null;
 const lo=Math.min(...clean),hi=Math.max(...clean);
 if(!(hi>lo))return null;
 const rank=(current-lo)/(hi-lo);
 return Math.max(0,Math.min(1,rank));
}
