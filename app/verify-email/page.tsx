"use client";
import {useState} from "react";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
export default function VerifyEmail(){
 const {data:session,isPending}=authClient.useSession();
 const [email,setEmail]=useState("");const [loading,setLoading]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 async function send(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");setMessage("");
 const address=session?.user?.email||email.trim();
 if(!address){setError("Sign in or enter your account email.");setLoading(false);return;}
 try{
 const r=await authClient.sendVerificationEmail({email:address,callbackURL:window.location.origin+"/verify-email?verified=1"});
 if(r.error){setError(r.error.message||"Could not send verification email.");}else{setMessage("Verification requested. Check your inbox and junk mail. Only use the link sent to your email.");}
 }catch(err){setError(err instanceof Error?err.message:"Verification request failed.");}finally{setLoading(false);}
 }
 return <main style={{minHeight:"100vh",background:"#081d2e",color:"#f2e7cf",padding:24,display:"grid",placeItems:"center"}}><section style={{width:"min(100%,470px)",border:"1px solid #bca06d",borderRadius:18,padding:30,background:"#102638"}}>
 <Link href="/agent-network" style={{color:"#e5c987"}}>← Research dashboard</Link><h1>Verify your email</h1><p style={{color:"#bbccd5",lineHeight:1.6}}>Your TradeOS account is signed in, but private research requires verified email ownership. Request a confirmation link and open it from the inbox you control.</p>
 {isPending?<p>Checking account…</p>:session?.user?<p>Account: <strong>{session.user.email}</strong></p>:<p>Sign in first, or enter your existing account email below.</p>}
 <form onSubmit={send} style={{display:"grid",gap:12}}>
 {!session?.user&&<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{display:"block",width:"100%",padding:12,marginTop:8}}/></label>}
 <button disabled={loading||isPending} style={{padding:13,border:0,borderRadius:8,background:"#d8bb81",fontWeight:700}}>{loading?"Requesting…":"Send verification email"}</button></form>
 {message&&<p role="status" style={{color:"#a6e3bf"}}>{message}</p>}{error&&<p role="alert" style={{color:"#ffb5b5"}}>{error}</p>}
 <p><Link href="/api/account-status" style={{color:"#e5c987"}}>Recheck account verification →</Link></p><small>Only verified and explicitly approved users may access private research. A verification email does not itself grant privileges.</small></section></main>;
}
