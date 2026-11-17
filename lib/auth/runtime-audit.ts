import {createHash,timingSafeEqual} from 'node:crypto';
/** Dedicated assertion-only observation capability. Never accepted by owner pages/research APIs. */
export function authorizeRuntimeAudit(request:Request,expectedHash=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256):401|403|503|200{
 if(!expectedHash||!/^[a-f0-9]{64}$/.test(expectedHash))return 503;
 const value=request.headers.get('authorization');
 if(!value)return 401;
 if(!/^Bearer [a-f0-9]{64}$/.test(value))return 403;
 const supplied=createHash('sha256').update(value.slice(7)).digest();
 return timingSafeEqual(supplied,Buffer.from(expectedHash,'hex'))?200:403;
}
