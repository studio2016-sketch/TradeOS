"use client";
import {useState} from "react";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
export default function SignIn(){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 const [pending,setPending]=useState(false);const [error,setError]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setError("");
 try{const result=await authClient.signIn.email({email,password});if(result.error){setError(result.error.message||"Sign-in unsuccessful");}else{window.location.assign("/agent-network");}}
 catch{setError("Unable to sign in right now.");}finally{setPending(false);}
 }
 return <main style={{minHeight:"100vh",background:"linear-gradient(135deg,#071827,#102a40)",color:"#f2e7cf",display:"grid",placeItems:"center",padding:24}}>
 <section style={{width:"min(100%,440px)",background:"#102638",padding:32,border:"1px solid #b39a66",borderRadius:18}}>
 <Link href="/" style={{color:"#c6b285"}}>← TradeOS</Link><h1 style={{fontSize:34,marginBottom:8}}>Secure Sign In</h1>
 <p style={{color:"#adc2d1",lineHeight:1.6}}>Private research access for approved TradeOS members. Accounts are managed by the TradeOS owner.</p>
 <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:22}}>
 <label>Email address<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6,borderRadius:7}}/></label>
 <label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6,borderRadius:7}}/></label>
 {error&&<p role="alert" style={{color:"#ffa7a7"}}>{error}</p>}
 <button disabled={pending} style={{padding:14,background:"#d8bb81",color:"#092033",border:0,borderRadius:9,fontWeight:700}}>{pending?"Signing in…":"Sign In"}</button>
 </form><p style={{fontSize:12,color:"#a3b6c3",marginTop:24}}>An account in Neon Auth does not automatically grant research permissions.</p></section></main>;
}
