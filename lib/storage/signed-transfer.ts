import {S3Client,PutObjectCommand,GetObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
const bucket=()=>process.env.TRADEOS_RESEARCH_STORAGE_BUCKET;
function client(){
 const endpoint=process.env.TRADEOS_RESEARCH_STORAGE_ENDPOINT;
 const region=process.env.TRADEOS_RESEARCH_STORAGE_REGION;
 const accessKeyId=process.env.TRADEOS_STORAGE_ACCESS_KEY_ID;
 const secretAccessKey=process.env.TRADEOS_STORAGE_SECRET_ACCESS_KEY;
 if(!endpoint||!region||!accessKeyId||!secretAccessKey||!bucket())return null;
 if(!endpoint.startsWith("https://"))throw Error("Storage endpoint must use HTTPS");
 return new S3Client({endpoint,region,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey}});
}
export function storageSigningReady(){return Boolean(client());}
export async function signResearchTransfer(input:{ownerId:string;sha256:string;bytes:number;contentType:string;operation:"upload"|"download"}){
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.ownerId)||!/^[a-f0-9]{64}$/.test(input.sha256))throw Error("Invalid artifact identity");
 if(!Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>25*1024*1024)throw Error("Invalid artifact size");
 const s3=client();if(!s3)throw Error("Private object signing unavailable");
 const Key="owners/"+input.ownerId+"/sha256/"+input.sha256.slice(0,2)+"/"+input.sha256;
 const command=input.operation==="upload"?new PutObjectCommand({Bucket:bucket(),Key,ContentType:input.contentType}):new GetObjectCommand({Bucket:bucket(),Key});
 return {url:await getSignedUrl(s3,command,{expiresIn:180}),key:Key,expiresInSeconds:180};
}
