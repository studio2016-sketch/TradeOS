"use client";
import {useState} from "react";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
export default function VerifyEmail(){
 const {data:session,isPending}=authClient.useSession();
 const [email,setEmail]=useState("");const [code,setCode]=useState("");const [verifying,setVerifying]=useState(false);const [loading,setLoading]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 async function send(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");setMessage("");
 const address=session?.user?.email||email.trim();
 if(!address){setError("Sign in or enter your account email.");setLoading(false);return;}
 try{
 const r=await authClient.sendVerificationEmail({email:address,callbackURL:window.location.origin+"/verify-email?verified=1"});
 if(r.error){setError(r.error.message||"Could not send verification email.");}else{setMessage("Verification requested. Enter the latest emailed code in the field below.");}
 }catch(err){setError(err instanceof Error?err.message:"Verification request failed.");}finally{setLoading(false);}
 }
 async function verify(e:React.FormEvent){e.preventDefault();setError("");setMessage("");
 const address=session?.user?.email||email.trim();if(!address){setError("Sign in to verify your account.");return;}
 if(!/^\\d{6,8}$/.test(code.trim())){setError("Enter the numeric code from your email.");return;}
 setVerifying(true);try{const response=await fetch("/api/auth/email-otp/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email:address,otp:code.trim()})});
 const result=await response.json().catch(()=>({}));if(!response.ok){setError(result?.message||"Code could not be verified. Request a new code if it expired.");}else{setMessage("Email verification accepted. Recheck your account authorization.");setCode("");}}
 catch{setError("Verification service could not be reached.");}finally{setVerifying(false);}
 }
 return <main style={{minHeight:"100vh",background:"#081d2e",color:"#f2e7cf",padding:24,display:"grid",placeItems:"center"}}><section style={{width:"min(100%,470px)",border:"1px solid #bca06d",borderRadius:18,padding:30,background:"#102638"}}>
 <Link href="/agent-network" style={{color:"#e5c987"}}>← Research dashboard</Link><h1>Verify your email</h1><p style={{color:"#bbccd5",lineHeight:1.6}}>Your TradeOS account is signed in, but private research requires verified email ownership. Request a verification code, then enter the code below.</p>
 {isPending?<p>Checking account…</p>:session?.user?<p>Account: <strong>{session.user.email}</strong></p>:<p>Sign in first, or enter your existing account email below.</p>}
 <form onSubmit={send} style={{display:"grid",gap:12}}>
 {!session?.user&&<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{display:"block",width:"100%",padding:12,marginTop:8}}/></label>}
 <button disabled={loading||isPending} style={{padding:13,border:0,borderRadius:8,background:"#d8bb81",fontWeight:700}}>{loading?"Requesting…":"Send verification email"}</button></form>
 <form onSubmit={verify} style={{display:"grid",gap:12,marginTop:18}}><label>Verification code from email<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={e=>setCode(e.target.value.replace(/\\D/g,"").slice(0,8))} placeholder="Enter the email code" aria-label="Email verification code" style={{display:"block",width:"100%",padding:12,marginTop:8,color:"#122638"}}/></label><p style={{fontSize:13,color:"#bbccd5",margin:0}}>Enter all digits from the latest verification email. {code.length>0?`${code.length} digit(s) entered`:"Waiting for code…"}</p><button type="submit" disabled={verifying||code.length<6} style={{padding:13,background:code.length>=6?"#a6ddc6":"#536777",color:code.length>=6?"#092b20":"#d7e0e5",border:0,borderRadius:8,fontWeight:700,cursor:code.length>=6?"pointer":"not-allowed"}}>{verifying?"Verifying…":code.length<6?"Enter code to enable verification":"Verify code"}</button></form>{message&&<p role="status" style={{color:"#a6e3bf"}}>{message}</p>}{error&&<p role="alert" style={{color:"#ffb5b5"}}>{error}</p>}
 <p><Link href="/api/account-status" style={{color:"#e5c987"}}>Recheck account verification →</Link></p><small>Only verified and explicitly approved users may access private research. A verification email does not itself grant privileges.</small></section></main>;
}
