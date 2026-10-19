export type DiscoveryInput={hypothesis:string;sourceUrl:string;discoveredAt:string;origin:"external_agent"|"public_research"|"manual"};
export type DiscoveryAssessment={accepted:boolean;classification:"unverified_external_claim"|"invalid_source"|"invalid_claim";flags:string[];safeForModelPromotion:false;safeForOrderExecution:false};
const privateHosts=/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|[^.]+)$/i;
export function assessDiscovery(input:DiscoveryInput):DiscoveryAssessment{
 const flags:string[]=[];
 let url:URL|null=null;
 try{url=new URL(input.sourceUrl)}catch{flags.push("malformed_url")}
 if(url){
  if(url.protocol!=="https:")flags.push("non_https_source");
  if(url.username||url.password)flags.push("credentials_embedded");
  if(privateHosts.test(url.hostname)||url.hostname.endsWith(".local")||url.hostname.endsWith(".internal")||url.hostname.endsWith(".localhost")||url.hostname.endsWith(".test")||url.hostname.endsWith(".invalid")||url.hostname.endsWith(".example")||url.hostname.endsWith(".onion")||/^(172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.18\.|198\.19\.|192\.0\.|192\.88\.|224\.|2[3-5]\d\.|\[fc|\[fd|\[fe80)/i.test(url.hostname))flags.push("private_network_source");
  if(url.port&&url.port!=="443")flags.push("nonstandard_port");
  if(input.sourceUrl.length>1000)flags.push("oversized_source");
 }
 if(input.hypothesis.trim().length<10||input.hypothesis.length>1000)flags.push("invalid_hypothesis_length");
 if(!Number.isFinite(Date.parse(input.discoveredAt)))flags.push("invalid_observation_time");
 if(input.discoveredAt&&Date.parse(input.discoveredAt)>Date.now()+60000)flags.push("future_timestamp");
 return {accepted:flags.length===0,classification:flags.length?(flags.some(x=>x.includes("source")||x.includes("url")||x.includes("network")||x.includes("https")||x.includes("credentials"))?"invalid_source":"invalid_claim"):"unverified_external_claim",flags,safeForModelPromotion:false,safeForOrderExecution:false};
}
