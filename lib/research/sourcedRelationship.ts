import {createHash} from "node:crypto";
export const entityKinds=["company","instrument","industry","commodity","currency","economic_event"] as const;
export const relationKinds=["SUPPLIES","CUSTOMER_OF","COMPETES_WITH","MEMBER_OF","EXPOSED_TO","REFERENCES"] as const;
export type SourcedRelationship={subjectKind:string;subjectId:string;relation:string;objectKind:string;objectId:string;sourceUrl:string;sourceName:string;publishedAt:string;observedAt:string;evidenceExcerpt:string};
export function validateSourcedRelationship(input:unknown,now=Date.now()){
 if(!input||typeof input!=="object")return {valid:false as const,error:"Expected object"};
 const x=input as Record<string,unknown>;
 const text=(k:string,max:number)=>typeof x[k]==="string"&&x[k].trim().length>0&&x[k].length<=max?x[k].trim():"";
 const subjectKind=text("subjectKind",30),objectKind=text("objectKind",30),relation=text("relation",30);
 const subjectId=text("subjectId",120),objectId=text("objectId",120),sourceUrl=text("sourceUrl",1200),sourceName=text("sourceName",200);
 const publishedAt=text("publishedAt",70),observedAt=text("observedAt",70),evidenceExcerpt=text("evidenceExcerpt",2000);
 if(!entityKinds.includes(subjectKind as any)||!entityKinds.includes(objectKind as any)||!relationKinds.includes(relation as any))
  return {valid:false as const,error:"Unsupported entity or relation"};
 if(!subjectId||!objectId||!sourceUrl||!sourceName||!evidenceExcerpt)return {valid:false as const,error:"Relationship requires explicit source identity and evidence"};
 let url:URL;try{url=new URL(sourceUrl)}catch{return {valid:false as const,error:"Invalid source URL"}}
 if(url.protocol!=="https:"||!url.hostname.includes("."))return {valid:false as const,error:"A HTTPS evidence URL is required"};
 const published=Date.parse(publishedAt),observed=Date.parse(observedAt);
 if(!Number.isFinite(published)||!Number.isFinite(observed)||published>now+60000||observed>now+60000)
  return {valid:false as const,error:"Source publication and observation timestamps must be real and not in the future"};
 if(observed<published)return {valid:false as const,error:"Source cannot be observed before its publication"};
 const record={subjectKind,subjectId,relation,objectKind,objectId,sourceUrl:url.toString(),sourceName,publishedAt:new Date(published).toISOString(),observedAt:new Date(observed).toISOString(),evidenceExcerpt};
 const checksum=createHash("sha256").update(JSON.stringify(record)).digest("hex");
 return {valid:true as const,record,checksum,verificationStatus:"SOURCE_RECORDED" as const};
}
