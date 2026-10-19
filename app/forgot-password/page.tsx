"use client";
import {useState} from "react";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
export default function ForgotPassword(){
 const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [pending,setPending]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setError("");setMessage("");
 try{
 const result=await authClient.requestPasswordReset({email,redirectTo:window.location.origin+"/reset-password"});
 if(result.error){setError(result.error.message||"Password reset request was unsuccessful.");}
 else setMessage("If this email is eligible, a password reset message will arrive shortly. Check your spam folder as well.");
 }catch(err){setError(err instanceof Error?err.message:"The authentication service could not be reached.");}finally{setPending(false);}
 }
 return <main style={{minHeight:"100vh",background:"#081d2e",color:"#f2e7cf",display:"grid",placeItems:"center",padding:24}}>
 <section style={{maxWidth:450,width:"100%",padding:32,border:"1px solid #b39a66",borderRadius:18,background:"#102638"}}>
 <Link href="/sign-in" style={{color:"#e6c683"}}>← Back to sign in</Link><h1>Set or reset your password</h1>
 <p style={{color:"#b4c7d1"}}>Enter the address of your existing Neon Auth account. For security, receiving a reset email does not grant research access.</p>
 <form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",padding:12,margin:"9px 0 16px",borderRadius:8}}/></label>
 <button disabled={pending} style={{padding:13,border:0,borderRadius:8,background:"#d8bb81",fontWeight:700,width:"100%"}}>{pending?"Sending…":"Email password setup link"}</button></form>
 {message&&<p role="status" style={{color:"#a6e3bf"}}>{message}</p>}{error&&<p role="alert" style={{color:"#ffb2b2"}}>{error}</p>}
 </section></main>;
}
