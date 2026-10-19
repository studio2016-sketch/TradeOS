"use client";
import {Suspense,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
function Form(){
 const params=useSearchParams();const token=params.get("token");const errorCode=params.get("error");
 const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError("");
 if(password.length<12){setError("Use a password at least 12 characters long.");return;}
 if(password!==confirm){setError("Passwords do not match.");return;}
 if(!token){setError("This reset link is missing its token. Request a new link.");return;}
 setPending(true);
 try{const result=await authClient.resetPassword({newPassword:password,token});if(result.error){setError(result.error.message||"Unable to reset password.");}else{setDone(true);}}
 catch(err){setError(err instanceof Error?err.message:"Unable to reach authentication service.");}finally{setPending(false);}
 }
 return <main style={{minHeight:"100vh",background:"#081d2e",color:"#f2e7cf",display:"grid",placeItems:"center",padding:24}}><section style={{maxWidth:450,width:"100%",padding:32,border:"1px solid #b39a66",borderRadius:18,background:"#102638"}}>
 <h1>Choose your TradeOS password</h1>
 {done?<p>Password updated. <Link href="/sign-in" style={{color:"#e6c683"}}>Sign in →</Link></p>:<>
 {errorCode&&<p role="alert">This link could not be verified: {errorCode}</p>}
 {!token?<p>Open the password setup link from your email, or <Link href="/forgot-password" style={{color:"#e6c683"}}>request a new one</Link>.</p>:<form onSubmit={submit} style={{display:"grid",gap:14}}>
 <label>New password<input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6}}/></label>
 <label>Confirm password<input required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6}}/></label>
 <button disabled={pending} style={{padding:13,background:"#d8bb81",border:0,borderRadius:8,fontWeight:700}}>{pending?"Updating…":"Set password"}</button></form>}
 {error&&<p role="alert" style={{color:"#ffb2b2"}}>{error}</p>}</>}
 </section></main>;
}
export default function ResetPassword(){return <Suspense fallback={<p>Loading reset page…</p>}><Form/></Suspense>;}
