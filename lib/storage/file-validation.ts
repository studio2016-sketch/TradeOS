export const MAX_RESEARCH_BYTES=25*1024*1024;
const allowed=new Set(["text/csv","application/json","application/pdf","text/plain","application/octet-stream","application/vnd.apache.parquet"]);
export function validateArtifactInput(input:{size:number;contentType:string;filename:string}){
 const mime=input.contentType.split(";")[0].trim().toLowerCase();
 if(!Number.isSafeInteger(input.size)||input.size<1||input.size>MAX_RESEARCH_BYTES)return {allowed:false,reason:"File size must be 1 byte to 25 MiB"};
 if(!allowed.has(mime))return {allowed:false,reason:"Unsupported content type"};
 if(input.filename.length<1||input.filename.length>160||/[/\\\x00-\x1f]/.test(input.filename))return {allowed:false,reason:"Invalid filename"};
 return {allowed:true,reason:"Eligible for authenticated screening; not approved for public upload"};
}
